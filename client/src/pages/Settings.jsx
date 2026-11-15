import { useLanguage } from "../i18n/LanguageContext";
import { useState, useMemo, useId } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  FiSearch, FiChevronDown, FiChevronUp, FiList, FiUserCheck, FiCheckSquare,
  FiHeart, FiLifeBuoy, FiHelpCircle,
} from "react-icons/fi";
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

  const query = search.trim().toLowerCase();
  const shown = visible.filter((f) =>
    (category === "all" || f.category === category) &&
    (!query || f.q.toLowerCase().includes(query) || f.a.toLowerCase().includes(query))
  );

  // The open answer closes as soon as its question is no longer listed
  // (another category, or a search that no longer matches it).
  const expanded = shown.some((f) => f.no === openNo) ? openNo : null;

  const chooseCategory = (id) => { setCategory(id); setOpenNo(null); };
  const toggle = (no) => setOpenNo((cur) => (cur === no ? null : no));
  const activeLabel = FAQ_CATEGORIES.find((c) => c.id === category)?.label || "All Questions";

  return (
    <PageLayout breadcrumbItems={[{ label: "FAQ" }]}>
      <div className="faq-page">
        <section className="faq-intro">
          <div className="faq-intro-icon" aria-hidden="true"><FiHelpCircle /></div>
          <div>
            <h1 className="faq-title">Frequently Asked Questions (FAQ)</h1>
            <p className="faq-lead">
              This section provides answers to common questions that users may encounter while accessing and using the PoultryBiz system. It aims to help both Owners and Farmers understand the system's basic functions and resolve common concerns.
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
                {shown.length} {shown.length === 1 ? t("question") : t("questions")}
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
                        <span className="faq-q-text">{f.q}</span>
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
                          <p>{f.a}</p>
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