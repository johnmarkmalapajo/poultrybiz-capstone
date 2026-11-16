import { useLanguage } from "../i18n/LanguageContext";
import { useState, useMemo, useId } from "react";
import { useSearchParams, useLocation, Link, useNavigate } from "react-router-dom";
import {
  FiSearch, FiChevronDown, FiChevronUp, FiList, FiUserCheck, FiCheckSquare,
  FiHeart, FiLifeBuoy, FiHelpCircle, FiArrowRight, FiUser, FiMail, FiPhone,
  FiInfo, FiGrid, FiHeadphones, FiUsers,
} from "react-icons/fi";
import systemLogo from "../assets/sidelogo.jpg";
import { version as SYSTEM_VERSION } from "../../package.json";
import PageLayout from "../components/PageLayout";
import "./Settings.css";
import "./Flockprofile.css";
import Profile from "./Profile";
import UsersRoles from "./UsersRoles";
import AuditLogs from "./AuditLogs";
import Archive from "./Archive";
import { useUser } from "../hooks/useUser";

const ALL_CARDS = [
  {
    id: "profile",
    label: "My Profile",
    emoji: "👤",
    description: "Update your name, contact, and profile photo",
    color: "#e8a020",
    bg: "#fff8ec",
    ownerOnly: false,
  },
  {
    id: "users-roles",
    label: "Users & Roles",
    emoji: "👥",
    description: "Manage accounts, approvals, and access permissions",
    color: "#a855f7",
    bg: "#f3e8ff",
    ownerOnly: true,
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    emoji: "📋",
    description: "Monitor activity history and system changes",
    color: "#5aab6e",
    bg: "#edf7f0",
    ownerOnly: true,
  },
  {
    id: "archive",
    label: "Archive",
    emoji: "🗂️",
    description: "View and restore archived records",
    color: "#4a90d9",
    bg: "#eef4fc",
    ownerOnly: true,
  },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { t } = useLanguage();

  const { isManagement, isOwner } = useUser();

  const cards = ALL_CARDS.filter(
    (card) => (card.id === "audit-logs" ? isOwner : !card.ownerOnly || isManagement)
  );

  const VALID = cards.map((c) => c.id);

  const raw = searchParams.get("view");
  const viewMode = VALID.includes(raw) ? raw : "menu";
  const activeCard = cards.find((c) => c.id === viewMode);

  const openCard = (id) => setSearchParams({ view: id });
  const backToMenu = () => setSearchParams({});

  const fromSidebar =
    viewMode === "profile" &&
    Boolean(location.state?.fromSidebar);

  const breadcrumbItems =
    viewMode === "menu"
      ? [{ label: "SETTINGS" }]
      : fromSidebar
      ? [{ label: "PROFILE" }]
      : [
          { label: "SETTINGS", path: "/settings" },
          { label: (activeCard?.label || "").toUpperCase() },
        ];

  return (
    <PageLayout breadcrumbItems={breadcrumbItems}>
      {viewMode === "menu" ? (
        <div className="st-grid">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="st-card"
              style={{
                "--card-color": card.color,
                "--card-bg": card.bg,
                animationDelay: `${i * 80}ms`,
              }}
              onClick={() => openCard(card.id)}
            >
              <div className="st-card-icon-wrap">
                <span className="st-card-emoji">{card.emoji}</span>
              </div>

              <div className="st-card-body">
                <span className="st-card-label">{t(card.label)}</span>
                <span className="st-card-desc">{t(card.description)}</span>
              </div>

              <span className="st-card-arrow">›</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {viewMode === "profile" && (
            <Profile embedded onBack={backToMenu} />
          )}

          {viewMode === "users-roles" && isManagement && (
            <UsersRoles embedded onBack={backToMenu} />
          )}

          {viewMode === "audit-logs" && isOwner && (
            <AuditLogs embedded onBack={backToMenu} />
          )}

          {viewMode === "archive" && isManagement && (
            <Archive embedded onBack={backToMenu} />
          )}
        </>
      )}
    </PageLayout>
  );
}

// ── FAQ (/faq) ───────────────────────────────────────────────────────────
// The FAQ page lives here, beside Settings (help for using the system), so
// no new JS/JSX file is needed. It reuses PageLayout (sidebar, header,
// breadcrumb), the shared search box (fp-search-box) and the PoultryBiz
// palette; its own styles are the faq-* rules in Settings.css.
//
// The 10 official questions and answers, word for word. `roles` lists the
// account roles each one is shown to: every official answer is general
// system information that applies to both Owners and Farmers (none of them
// is an Owner-only instruction), so all ten are shown to both roles.
// The questions, answers and introduction are the English keys of the
// Filipino entries in i18n/tl.phase3.js, so t() shows them in the selected
// language.
const FAQ_INTRO = "This section provides answers to common questions that users may encounter while accessing and using the PoultryBiz system. It aims to help both Owners and Farmers understand the system's basic functions and resolve common concerns.";
const FAQ_ROLES_ALL = ["Owner", "Farmer"];
const FAQ_ITEMS = [
  {
    no: 1, category: "access", roles: FAQ_ROLES_ALL,
    q: "How can I access the PoultryBiz system?",
    a: "Users can access the system through its provided URL or by scanning the system's QR code using a device's built-in camera or QR code scanner. An internet connection is required to access the system.",
  },
  {
    no: 2, category: "access", roles: FAQ_ROLES_ALL,
    q: "How can I create an account in PoultryBiz?",
    a: "Users can register by opening the registration page and providing the required information. The first registered account is automatically assigned as the Owner, while subsequent registrations are assigned as Farmers. All newly registered accounts require Owner approval before they can log in.",
  },
  {
    no: 3, category: "access", roles: FAQ_ROLES_ALL,
    q: "Why can't I log in after registering?",
    a: "Newly registered accounts cannot access the system until the Owner approves their registration request. Users should wait for approval before attempting to log in.",
  },
  {
    no: 4, category: "access", roles: FAQ_ROLES_ALL,
    q: "What is the difference between the Owner and Farmer accounts?",
    a: "The Owner has administrative access to manage users, personnel, farm operations, records, inventory, sales, and other system functionalities. Farmers have access to assigned modules and authorized functionalities based on their account permissions.",
  },
  {
    no: 5, category: "attendance", roles: FAQ_ROLES_ALL,
    q: "How can Farmers record their attendance?",
    a: "Farmers can record their attendance by scanning the shared attendance QR code provided through the Personnel and Manpower module. The QR code is valid for all Farmers on the designated day.",
  },
  {
    no: 6, category: "attendance", roles: FAQ_ROLES_ALL,
    q: "How can I monitor my assigned tasks?",
    a: "Users can access the To Do module to view their assigned tasks, due dates, priorities, and completion statuses. Farmers can also update the status of their assigned tasks when completed.",
  },
  {
    no: 7, category: "records", roles: FAQ_ROLES_ALL,
    q: "Where can I view poultry health and vaccination records?",
    a: "Users can access the Health Record under the Records module to view poultry health information, including diagnosis, treatment, vaccination, and veterinary visit records.",
  },
  {
    no: 8, category: "support", roles: FAQ_ROLES_ALL,
    q: "Can I access the system using a mobile device?",
    a: "Yes. Users can access PoultryBiz through a supported web browser on a mobile device, provided that the device has a stable internet connection.",
  },
  {
    no: 9, category: "support", roles: FAQ_ROLES_ALL,
    q: "What should I do if I cannot access a particular module?",
    a: "Users should verify whether the module is included in their assigned account permissions. If access is still unavailable, they should contact the Owner for assistance.",
  },
  {
    no: 10, category: "support", roles: FAQ_ROLES_ALL,
    q: "What should I do if I encounter an error while using the system?",
    a: "Users should check the entered information, verify their internet connection, and try the operation again. If the issue persists, they should refer to Section 6 – Error Handling and Troubleshooting or contact the Owner for assistance.",
  },
];

const FAQ_CATEGORIES = [
  { id: "all", label: "All Questions", Icon: FiList },
  { id: "access", label: "Access and Account Management", Icon: FiUserCheck },
  { id: "attendance", label: "Attendance and Task Management", Icon: FiCheckSquare },
  { id: "records", label: "Poultry Records and Health", Icon: FiHeart },
  { id: "support", label: "System Access and Support", Icon: FiLifeBuoy },
];

export function FAQ() {
  const { t } = useLanguage();
  const { role } = useUser();
  const baseId = useId();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openNo, setOpenNo] = useState(null);

  // Only the questions for the signed-in account's role.
  const visible = useMemo(() => FAQ_ITEMS.filter((f) => f.roles.includes(role)), [role]);

  const counts = useMemo(() => {
    const c = { all: visible.length };
    FAQ_CATEGORIES.forEach((cat) => {
      if (cat.id !== "all") c[cat.id] = visible.filter((f) => f.category === cat.id).length;
    });
    return c;
  }, [visible]);

  // Search matches the question and answer in the language shown, and the
  // English original as well.
  const query = search.trim().toLowerCase();
  const matches = (f) => [f.q, f.a, t(f.q), t(f.a)].some((text) => text.toLowerCase().includes(query));
  const shown = visible.filter((f) =>
    (category === "all" || f.category === category) && (!query || matches(f))
  );

  // The open answer closes as soon as its question is no longer listed
  // (another category, or a search that no longer matches it).
  const expanded = shown.some((f) => f.no === openNo) ? openNo : null;

  const chooseCategory = (id) => { setCategory(id); setOpenNo(null); };
  const toggle = (no) => setOpenNo((cur) => (cur === no ? null : no));
  const activeLabel = FAQ_CATEGORIES.find((c) => c.id === category)?.label || "All Questions";

  return (
    <PageLayout breadcrumbItems={[{ label: "Help & Support", path: "/help-support" }, { label: "FAQ" }]}>
      <div className="faq-page">
        <section className="faq-intro">
          <div className="faq-intro-icon" aria-hidden="true"><FiHelpCircle /></div>
          <div>
            <h1 className="faq-title">{t("Frequently Asked Questions (FAQ)")}</h1>
            <p className="faq-lead">
              {t(FAQ_INTRO)}
            </p>
          </div>
        </section>

        <div className="fp-search-box faq-search">
          <FiSearch />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search questions and answers...")}
            aria-label={t("Search questions and answers")}
          />
        </div>

        <div className="faq-layout">
          <nav className="faq-categories" aria-label={t("FAQ categories")}>
            <h2 className="faq-panel-title">{t("Categories")}</h2>
            <ul>
              {FAQ_CATEGORIES.map(({ id, label, Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    className={`faq-cat ${category === id ? "active" : ""}`}
                    aria-pressed={category === id}
                    onClick={() => chooseCategory(id)}
                  >
                    <span className="faq-cat-icon" aria-hidden="true"><Icon /></span>
                    <span className="faq-cat-label">{t(label)}</span>
                    <span className="faq-cat-count">{counts[id] ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="faq-questions" aria-label={t(activeLabel)}>
            <div className="faq-questions-head">
              <h2 className="faq-panel-title">{t(activeLabel)}</h2>
              <span className="faq-result-count">
                {t(shown.length === 1 ? "{n} question" : "{n} questions", { n: shown.length })}
              </span>
            </div>

            {shown.length === 0 ? (
              <div className="faq-empty" role="status">
                <FiSearch aria-hidden="true" />
                <p className="faq-empty-title">{t("No matching questions")}</p>
                <p>{t("Try a different search term or choose another category.")}</p>
              </div>
            ) : (
              <ul className="faq-list">
                {shown.map((f) => {
                  const isOpen = expanded === f.no;
                  const qId = `${baseId}-q${f.no}`;
                  const aId = `${baseId}-a${f.no}`;
                  return (
                    <li key={f.no} className={`faq-item ${isOpen ? "open" : ""}`}>
                      <button
                        type="button"
                        id={qId}
                        className="faq-question"
                        aria-expanded={isOpen}
                        aria-controls={aId}
                        onClick={() => toggle(f.no)}
                      >
                        <span className="faq-no">{f.no}.</span>
                        <span className="faq-q-text">{t(f.q)}</span>
                        <span className="faq-chevron" aria-hidden="true">
                          {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                        </span>
                      </button>
                      <div
                        id={aId}
                        role="region"
                        aria-labelledby={qId}
                        className="faq-answer"
                        aria-hidden={!isOpen}
                      >
                        <div className="faq-answer-inner">
                          <p>{t(f.a)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="faq-help">
          <div className="faq-help-icon" aria-hidden="true"><FiLifeBuoy /></div>
          <div>
            <h2 className="faq-help-title">{t("Still need help?")}</h2>
            <p>{t("Can't find what you're looking for? Contact the system administrator for assistance.")}</p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}


// ── Help & Support (/help-support) ──────────────────────────────────────
// Landing page of the Help & Support group (sidebar). Its FAQ card opens the
// existing FAQ page above (/faq); the other two open About the Developer and
// About the System below. Styles: hs-* in Settings.css.

// Small illustrations in the PoultryBiz palette (brown #47321C, tan #BB8D6B,
// sand #DEA77F, cream #FFFDF6, gold #E4AF1F). Decorative only.
function HenIllustration() {
  return (
    <svg viewBox="0 0 220 140" className="hs-hero-art" aria-hidden="true" focusable="false">
      <ellipse cx="112" cy="122" rx="92" ry="12" fill="#DEA77F" opacity="0.35" />
      <path d="M40 120 Q112 92 184 120 Z" fill="#BB8D6B" opacity="0.55" />
      <ellipse cx="78" cy="110" rx="11" ry="14" fill="#FFFDF6" stroke="#DEA77F" strokeWidth="2" />
      <ellipse cx="146" cy="110" rx="11" ry="14" fill="#FFFDF6" stroke="#DEA77F" strokeWidth="2" />
      <path d="M70 92 C64 62 86 44 112 46 C122 30 146 30 150 46 C162 44 170 54 164 62 C176 70 172 92 154 100 C134 112 92 112 70 92 Z" fill="#FFFDF6" stroke="#47321C" strokeWidth="4" strokeLinejoin="round" />
      <path d="M140 34 q4 -10 10 -2 q6 -9 10 1 q8 -4 6 6" fill="#c8402c" stroke="#47321C" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="148" cy="50" r="3.4" fill="#47321C" />
      <path d="M160 52 l12 4 l-12 5 z" fill="#E4AF1F" stroke="#47321C" strokeWidth="2" strokeLinejoin="round" />
      <path d="M88 74 q22 -14 44 4 q-20 16 -44 -4 z" fill="#DEA77F" stroke="#47321C" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="112" cy="114" rx="11" ry="14" fill="#FFFDF6" stroke="#DEA77F" strokeWidth="2" />
    </svg>
  );
}

function FaqIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="hs-card-art" aria-hidden="true" focusable="false">
      <rect x="14" y="12" width="88" height="56" rx="14" fill="#FFFDF6" stroke="#47321C" strokeWidth="3.5" />
      <path d="M34 66 l-6 18 l20 -16" fill="#FFFDF6" stroke="#47321C" strokeWidth="3.5" strokeLinejoin="round" />
      <text x="58" y="52" textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="800" fontSize="34" fill="#E4AF1F">?</text>
      <rect x="70" y="44" width="76" height="50" rx="14" fill="#47321C" />
      <path d="M126 92 l8 14 l-22 -14" fill="#47321C" />
      <rect x="84" y="58" width="48" height="6" rx="3" fill="#E4AF1F" />
      <rect x="84" y="72" width="34" height="6" rx="3" fill="#DEA77F" />
    </svg>
  );
}

function DeveloperIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="hs-card-art" aria-hidden="true" focusable="false">
      <rect x="30" y="18" width="100" height="62" rx="8" fill="#FFFDF6" stroke="#47321C" strokeWidth="3.5" />
      <rect x="38" y="26" width="84" height="46" rx="4" fill="#47321C" />
      <path d="M62 40 l-10 9 l10 9 M98 40 l10 9 l-10 9" fill="none" stroke="#E4AF1F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M86 36 l-12 26" stroke="#DEA77F" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 84 h124 l-10 10 h-104 z" fill="#BB8D6B" stroke="#47321C" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="16" cy="40" r="8" fill="#DEA77F" stroke="#47321C" strokeWidth="2.5" />
      <path d="M4 66 q12 -20 24 0" fill="#E4AF1F" stroke="#47321C" strokeWidth="2.5" />
      <circle cx="144" cy="40" r="8" fill="#DEA77F" stroke="#47321C" strokeWidth="2.5" />
      <path d="M132 66 q12 -20 24 0" fill="#E4AF1F" stroke="#47321C" strokeWidth="2.5" />
    </svg>
  );
}

function SystemIllustration() {
  return (
    <div className="hs-card-art hs-system-art" aria-hidden="true">
      <div className="hs-window">
        <div className="hs-window-bar"><span /><span /><span /></div>
        <div className="hs-window-body">
          <img src={systemLogo} alt="" />
          <div className="hs-window-bars"><i /><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
}

const HELP_CARDS = [
  {
    to: "/faq",
    title: "Frequently Asked Questions",
    description: "Find answers to common questions about using PoultryBiz.",
    button: "View FAQs",
    Art: FaqIllustration,
  },
  {
    to: "/help-support/about-developer",
    title: "About the Developer",
    description: "Meet the developers behind PoultryBiz, their roles, and how to contact them.",
    button: "Meet the Developers",
    Art: DeveloperIllustration,
  },
  {
    to: "/help-support/about-system",
    title: "About the System",
    description: "Learn what PoultryBiz is, its purpose, its main features, and its version.",
    button: "Learn About the System",
    Art: SystemIllustration,
  },
];

export function HelpSupport() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <PageLayout breadcrumbItems={[{ label: "Help & Support" }]}>
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-hero-icon" aria-hidden="true"><FiHeadphones /></div>
          <div className="hs-hero-text">
            <h1 className="hs-title">{t("Help & Support")}</h1>
            <p className="hs-lead">{t("Find answers, learn about the system, and know more about the developers.")}</p>
          </div>
          <HenIllustration />
        </section>

        <div className="hs-cards">
          {HELP_CARDS.map(({ to, title, description, button, Art }) => (
            // The whole card opens its page; the button is the same link
            // for keyboard and screen-reader users.
            <article
              key={to}
              className="hs-card"
              onClick={(e) => { if (!e.target.closest("a")) navigate(to); }}
            >
              <div className="hs-card-art-wrap"><Art /></div>
              <h2 className="hs-card-title">{t(title)}</h2>
              <p className="hs-card-text">{t(description)}</p>
              <Link to={to} className="hs-card-btn">
                {t(button)} <FiArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}

// ── About the Developer (/help-support/about-developer) ─────────────────
// DEVELOPER PHOTOS -- put the four pictures in client/src/assets/developers/
// with these exact names: developer1.jpg, developer2.jpg, developer3.jpg,
// developer4.jpg (.jpeg, .png or .webp also work). They are picked up
// automatically at build time; a missing photo shows the developer's
// initials instead, so the page never breaks. Every photo is shown in the
// same round frame (object-fit: cover, never stretched); square or 4:5
// head-and-shoulders photos with the face near the centre look best.
const DEVELOPER_PHOTOS = import.meta.glob("../assets/developers/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
});

function developerPhoto(file) {
  if (!file) return "";
  const base = file.replace(/\.[^.]+$/, "");
  const key = Object.keys(DEVELOPER_PHOTOS).find((k) => {
    const name = k.split("/").pop();
    return name === file || name.replace(/\.[^.]+$/, "") === base;
  });
  return key ? DEVELOPER_PHOTOS[key] : "";
}

// THE FOUR DEVELOPER PROFILES -- edit only this list to change the details.
//   photo: file name inside client/src/assets/developers/
//   name, role (shown translated when a Filipino entry exists), email, phone.
//   photoPosition (optional): which part of the photo stays in the round
//   frame, as a CSS object-position, e.g. "center 20%". Default "center 25%".
// All four cards share one design, so the details and photos can be
// replaced without touching it.
const DEVELOPERS = [
  {
    photo: "developer1.jpg",
    name: "John Mark Malapajo",
    role: "Project Leader, Back-end Developer",
    email: "johnmarkmalapajo@gmail.com",
    phone: "09319468429",
  },
  {
    photo: "developer2.jpg",
    name: "Alleiyah Gonzaga",
    role: "QA Tester, Front-end Developer",
    email: "hayiellag95@gmail.com",
    phone: "09154719817",
  },
  {
    photo: "developer3.jpg",
    name: "Janna Mae Linga",
    role: "System Analyst, Researcher",
    email: "lingajanmae@gmail.com",
    phone: "09153156295",
  },
  {
    photo: "developer4.jpg",
    name: "Daisyrie Ann Nanza",
    role: "Data Analyst, Researcher",
    email: "daisyrieannnanza@gmail.com",
    phone: "09154723313",
  },
];

// 09xx xxx xxxx, the usual way to read a PH mobile number.
function formatPhone(phone) {
  const d = phone.replace(/\D/g, "");
  return /^09\d{9}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : phone;
}

function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function DeveloperCard({ dev, index }) {
  const { t } = useLanguage();
  const [photoFailed, setPhotoFailed] = useState(false);
  const label = t("Developer {n}", { n: index + 1 });
  const photo = developerPhoto(dev.photo);
  const hasDetails = Boolean(dev.name || dev.role || dev.email || dev.phone);
  const initials = initialsOf(dev.name);

  return (
    <article className="ad-card">
      <div className="ad-photo">
        {/* Shared backdrop: the decorations sit behind the round frame. */}
        <span className="ad-deco ad-deco-ring" aria-hidden="true" />
        <span className="ad-deco ad-deco-dots" aria-hidden="true" />
        <div className="ad-portrait">
          {photo && !photoFailed ? (
            <img
              src={photo}
              alt={dev.name || label}
              loading="lazy"
              style={{ objectPosition: dev.photoPosition || "center 25%" }}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div className="ad-photo-empty" role="img" aria-label={t("{label}: photo to be added", { label: dev.name || label })}>
              {initials ? <span className="ad-initials">{initials}</span> : <FiUser />}
            </div>
          )}
        </div>
      </div>
      <div className="ad-body">
        <h2 className="ad-name">{dev.name || label}</h2>
        <span className="ad-accent" aria-hidden="true" />
        {dev.role && <p className="ad-role">{t(dev.role)}</p>}
        {(dev.email || dev.phone) && (
          <ul className="ad-contact">
            {dev.email && (
              <li>
                <span className="ad-contact-icon"><FiMail aria-hidden="true" /></span>
                <span className="ad-sr-only">{t("Email Address")}: </span>
                <a href={`mailto:${dev.email}`}>
                  {/* A long address wraps after the "@", not mid-word. */}
                  {dev.email.split("@")[0]}<wbr />{dev.email.includes("@") ? `@${dev.email.split("@").slice(1).join("@")}` : ""}
                </a>
              </li>
            )}
            {dev.phone && (
              <li>
                <span className="ad-contact-icon"><FiPhone aria-hidden="true" /></span>
                <span className="ad-sr-only">{t("Contact Number")}: </span>
                <a href={`tel:${dev.phone.replace(/[^\d+]/g, "")}`}>{formatPhone(dev.phone)}</a>
              </li>
            )}
          </ul>
        )}
        {!hasDetails && <p className="ad-pending">{t("Details to be added")}</p>}
      </div>
    </article>
  );
}

export function AboutDeveloper() {
  const { t } = useLanguage();
  return (
    <PageLayout breadcrumbItems={[{ label: "Help & Support", path: "/help-support" }, { label: "About the Developer" }]}>
      <div className="hs-page">
        <section className="hs-hero hs-hero-compact ad-hero">
          <div className="hs-hero-icon" aria-hidden="true"><FiUsers /></div>
          <div className="hs-hero-text">
            <h1 className="hs-title">{t("About the Developer")}</h1>
            <p className="hs-lead">
              {t("Meet the team behind PoultryBiz. We are the developers responsible for designing and developing a digital solution for efficient poultry farm management.")}
            </p>
          </div>
        </section>

        {/* The page ends with the four profiles. */}
        <div className="ad-grid">
          {DEVELOPERS.slice(0, 4).map((dev, i) => <DeveloperCard key={i} dev={dev} index={i} />)}
        </div>
      </div>
    </PageLayout>
  );
}

// ── About the System (/help-support/about-system) ───────────────────────
// System version: client/package.json "version" (kept the same as
// server/package.json). Update it there when a new version is released.
const SYSTEM_FEATURES = [
  { title: "Dashboard", text: "Overview of the farm's flocks, egg production, and other key figures with charts." },
  { title: "Records", text: "Flock Profile, Egg Records, Health Records (diagnosis, treatment, vaccination, and veterinary visits), Mortality Records, Quarantine and Isolation, and Manure and Waste Records." },
  { title: "Inventory", text: "Feed Inventory, Feed Consumption, and Equipment and Tools." },
  { title: "Sales and Transactions", text: "Sales Records with egg pricing, and Expense Records with receipts." },
  { title: "Personnel and Visitors", text: "Personnel and Manpower with QR code attendance and task assignment, and Visitor records." },
  { title: "To Do", text: "Primary (daily), Secondary, and personal tasks with photo proof of completion." },
  { title: "Notifications", text: "In-system notifications with email copies." },
  { title: "Reports", text: "Excel and PDF export of records." },
  { title: "Administration", text: "Users and Roles with Owner approval of new accounts, Audit Logs, Archive and restore, and role-based access for Owners and Farmers." },
  { title: "Language", text: "English and Filipino." },
];

const SYSTEM_INFO = [
  { label: "System Name", value: "PoultryBiz" },
  { label: "Project Name", value: "Egginear Agri-Poultry Solutions" },
  { label: "System Version", value: SYSTEM_VERSION },
  { label: "Frontend", value: "React, Vite, React Router, Recharts" },
  { label: "Backend", value: "Node.js, Express" },
  { label: "Database", value: "MongoDB (Mongoose)" },
  { label: "Other", value: "JWT authentication, Multer file uploads, node-cron scheduled jobs, Nodemailer email", translate: true },
];

export function AboutSystem() {
  const { t } = useLanguage();
  return (
    <PageLayout breadcrumbItems={[{ label: "Help & Support", path: "/help-support" }, { label: "About the System" }]}>
      <div className="hs-page">
        <section className="as-intro">
          <div className="as-logo">
            <img src={systemLogo} alt={t("PoultryBiz logo")} />
          </div>
          <div className="as-intro-text">
            <h1 className="hs-title">PoultryBiz</h1>
            <p className="as-tagline">Egginear Agri-Poultry Solutions</p>
            <p className="hs-lead">
              {t("PoultryBiz is a poultry farm management and recordkeeping system. It helps the farm Owner and Farmers record, manage, and monitor daily poultry farm operations and records, including flocks, egg production, poultry health, inventory, sales and expenses, personnel, and tasks, in one web-based system that works on computers and mobile devices.")}
            </p>
            <span className="as-version-badge">{t("Version {version}", { version: SYSTEM_VERSION })}</span>
          </div>
        </section>

        <section className="hs-panel">
          <h2 className="hs-panel-title"><FiGrid aria-hidden="true" /> {t("Key Features")}</h2>
          <ul className="as-features">
            {SYSTEM_FEATURES.map((f) => (
              <li key={f.title}>
                <span className="as-feature-title">{t(f.title)}</span>
                <span className="as-feature-text">{t(f.text)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="hs-panel">
          <h2 className="hs-panel-title"><FiInfo aria-hidden="true" /> {t("System Information")}</h2>
          <dl className="as-info">
            {SYSTEM_INFO.map((row) => (
              <div key={row.label} className="as-info-row">
                <dt>{t(row.label)}</dt>
                <dd>{row.translate ? t(row.value) : row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </PageLayout>
  );
}