// Server-side session policy for PoultryBiz logins.
//
//   * Every login creates an AuthSession and the JWT carries its id (jti).
//   * Logging out revokes that session immediately -- the same token can no
//     longer be used, even if it was copied before logout.
//   * A session ends after SESSION_IDLE_MINUTES without any authenticated
//     request (default 60). Closing the tab and coming back later than that
//     therefore requires a new login.
//   * The JWT still expires after 7 days no matter how active the session is.
//   * Tokens issued before this policy existed carry no jti and are rejected,
//     so each user logs in once after the update.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AuthSession = require("../models/AuthSession");

const TOKEN_LIFETIME = "7d";
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_MINUTES = Math.max(5, Number(process.env.SESSION_IDLE_MINUTES) || 60);
const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;

// lastSeenAt is refreshed at most once a minute to avoid a write per request.
const TOUCH_INTERVAL_MS = 60 * 1000;

const SESSION_MESSAGES = {
  SESSION_REQUIRED: "Your session has expired. Please log in again.",
  SESSION_ENDED: "You have been logged out. Please log in again.",
  SESSION_IDLE: "Your session expired due to inactivity. Please log in again.",
};

const issueSessionToken = async (user) => {
  const jti = crypto.randomUUID();

  await AuthSession.create({
    jti,
    user: user._id,
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
  });

  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: TOKEN_LIFETIME,
      jwtid: jti,
    }
  );
};

// Returns { session } when the token's session is still usable, or
// { code, message } explaining why it is not.
const validateSession = async (decoded) => {
  if (!decoded?.jti) {
    return { code: "SESSION_REQUIRED", message: SESSION_MESSAGES.SESSION_REQUIRED };
  }

  const session = await AuthSession.findOne({ jti: decoded.jti });

  if (!session || String(session.user) !== String(decoded.id)) {
    return { code: "SESSION_REQUIRED", message: SESSION_MESSAGES.SESSION_REQUIRED };
  }

  if (session.revokedAt) {
    return session.revokedReason === "inactivity"
      ? { code: "SESSION_IDLE", message: SESSION_MESSAGES.SESSION_IDLE }
      : { code: "SESSION_ENDED", message: SESSION_MESSAGES.SESSION_ENDED };
  }

  const now = Date.now();
  const lastSeen = new Date(session.lastSeenAt || session.createdAt).getTime();

  if (now - lastSeen > SESSION_IDLE_MS) {
    await AuthSession.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: "inactivity" } }
    );
    return { code: "SESSION_IDLE", message: SESSION_MESSAGES.SESSION_IDLE };
  }

  if (now - lastSeen > TOUCH_INTERVAL_MS) {
    await AuthSession.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  }

  return { session };
};

const revokeSession = async (jti, reason = "logout") => {
  if (!jti) return;

  await AuthSession.updateOne(
    { jti, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
};

module.exports = {
  SESSION_IDLE_MINUTES,
  issueSessionToken,
  validateSession,
  revokeSession,
};