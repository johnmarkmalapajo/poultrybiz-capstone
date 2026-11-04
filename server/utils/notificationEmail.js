// Sends an email copy of every in-system notification.
//
// The rules for WHO gets the email are intentionally identical to the rules
// in notificationController.getNotifications, so an email is sent to exactly
// the people who would see that notification inside the system:
//   - userId set         -> only that one person
//   - userId null, roles -> everyone whose role is in `roles`
//   - userId null, roles empty -> everyone
//   - a Farmer never gets a notification outside FARMER_ALLOWED_CATEGORIES
//
// How the email is sent:
//   1. Brevo API (BREVO_API_KEY + MAIL_USER) -- same as "Forgot Password".
//      Use this on Render/production (plain HTTPS, never blocked).
//   2. Fallback: Gmail via nodemailer (MAIL_USER + MAIL_PASS app password)
//      when there is no BREVO_API_KEY. Handy for testing on localhost.
// Sending is best-effort: a mail failure is logged and never breaks the
// request/cron job that created the notification.

const User = require("../models/User");

// Categories a Farmer is allowed to see. Single source of truth: the
// notification controller imports this too.
const FARMER_ALLOWED_CATEGORIES = [
  "egg", "feed", "health", "mortality", "quarantine", "isolation",
  "equipment", "age", "task", "todo",
];

const PRIORITY_STYLE = {
  Critical: { bg: "#fde8e8", fg: "#b42318", label: "Critical" },
  Warning: { bg: "#fff4d6", fg: "#9a6700", label: "Warning" },
  Normal: { bg: "#e8f3ea", fg: "#256c3b", label: "Normal" },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clientBaseUrl = () =>
  String(process.env.CLIENT_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const formatPhTime = (date) =>
  new Date(date || Date.now()).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

// Works out the users who should receive this notification by email.
async function resolveRecipients(notification) {
  const baseFilter = {
    status: "Active",
    archived: { $ne: true },
    emailNotif: { $ne: false }, // respect the user's "Email notifications" toggle
    email: { $exists: true, $ne: "" },
  };

  let users;
  if (notification.userId) {
    users = await User.find({ ...baseFilter, _id: notification.userId })
      .select("name email role");
  } else {
    const roles = Array.isArray(notification.roles) ? notification.roles : [];
    const filter = roles.length ? { ...baseFilter, role: { $in: roles } } : baseFilter;
    users = await User.find(filter).select("name email role");
  }

  return users.filter((u) => {
    if (!u.email) return false;
    if (u.role === "Farmer") {
      return FARMER_ALLOWED_CATEGORIES.includes(notification.category);
    }
    return true;
  });
}

function buildEmail(notification, user) {
  const priority = PRIORITY_STYLE[notification.priority] || PRIORITY_STYLE.Normal;
  const typeLabel = notification.type === "reminder" ? "Reminder" : "Alert";
  const link = clientBaseUrl() ? `${clientBaseUrl()}/notifications` : "";

  const subjectPrefix =
    notification.priority && notification.priority !== "Normal"
      ? `[${notification.priority}] `
      : "";

  const subject = `${subjectPrefix}${notification.title} — PoultryBiz`;

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee;">
      <h2 style="color:#3b2008;margin:0 0 4px;">PoultryBiz ${typeLabel}</h2>
      <p style="margin:0 0 16px;color:#888;font-size:12px;">${escapeHtml(formatPhTime(notification.createdAt))}</p>

      <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>

      <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:${priority.bg};color:${priority.fg};">
        ${priority.label}
      </span>
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:#f3efe9;color:#3b2008;text-transform:capitalize;">
        ${escapeHtml(notification.category)}
      </span>

      <h3 style="color:#3b2008;margin:16px 0 8px;">${escapeHtml(notification.title)}</h3>
      <p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(notification.description)}</p>

      ${
        link
          ? `<a href="${escapeHtml(link)}" style="display:inline-block;margin:8px 0 16px;padding:12px 28px;background:#e8a020;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Open PoultryBiz</a>`
          : ""
      }

      <p style="color:#888;font-size:12px;">
        You are receiving this because email notifications are turned on for your PoultryBiz account.
        You can turn them off anytime in your profile settings.
      </p>
    </div>
  `;

  return { subject, htmlContent };
}

let gmailTransport = null;
const getGmailTransport = () => {
  if (!gmailTransport) {
    const nodemailer = require("nodemailer");
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
  }
  return gmailTransport;
};

// Display name shown as the sender in the recipient's inbox. Change it with
// MAIL_FROM_NAME in server/.env (default: "PoultryBiz").
const fromName = () => process.env.MAIL_FROM_NAME || "PoultryBiz";

const mailConfigured = () =>
  Boolean(process.env.MAIL_USER && (process.env.BREVO_API_KEY || process.env.MAIL_PASS));

async function sendOne(notification, user) {
  const { subject, htmlContent } = buildEmail(notification, user);

  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: fromName(), email: process.env.MAIL_USER },
        to: [{ email: user.email, name: user.name }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API error ${res.status}: ${body}`);
    }
    return;
  }

  // Fallback: Gmail SMTP (MAIL_USER + MAIL_PASS app password).
  await getGmailTransport().sendMail({
    from: `"${fromName()}" <${process.env.MAIL_USER}>`,
    to: `"${user.name}" <${user.email}>`,
    subject,
    html: htmlContent,
  });
}

// Fire-and-forget entry point. Never throws.
async function sendNotificationEmail(notification) {
  try {
    if (!notification) return;

    if (!mailConfigured()) {
      console.warn(
        "Notification email skipped: set MAIL_USER plus either BREVO_API_KEY or MAIL_PASS."
      );
      return;
    }

    const recipients = await resolveRecipients(notification);
    if (!recipients.length) {
      console.log(
        `[notification-email] No eligible recipients for "${notification.title}" ` +
          "(check user status is Active and Email notifications is ON)."
      );
      return;
    }

    // One email per person (so nobody sees anyone else's address).
    const results = await Promise.allSettled(
      recipients.map((user) => sendOne(notification, user))
    );

    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `[notification-email] FAILED to ${recipients[i].email}:`,
          result.reason?.message || result.reason
        );
      } else {
        console.log(`[notification-email] Sent to ${recipients[i].email}: "${notification.title}"`);
      }
    });
  } catch (error) {
    console.error("Send Notification Email Error:", error);
  }
}

module.exports = {
  sendNotificationEmail,
  resolveRecipients,
  FARMER_ALLOWED_CATEGORIES,
};