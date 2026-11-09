import { useLanguage } from "../i18n/LanguageContext";
import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { openSidebar } from "./Sidebar";
import NotificationBell from "./NotificationBell";
import "./Breadcrumb.css";

/**
 * Shared Breadcrumb — the ONE implementation used by every page in the app.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: "RECORDS", path: "/records" },
 *     { label: "MORTALITY RECORD" },   // no `path` = current page (last item)
 *   ]} />
 *
 * - Every item except the last should have a `path` (clickable, navigates there).
 * - The LAST item is always treated as the current page: not clickable,
 *   bold/gold styling.
 * - The header row (.pb-header-row) holds three siblings: the hamburger, the
 *   breadcrumb and the Notification Bell. The row carries the spacing the
 *   breadcrumb used to have on its own. The breadcrumb scrolls horizontally
 *   inside its own box when it is too long, so the Bell and hamburger stay
 *   pinned and can never overlap it.
 *   - Tablet / laptop / desktop (601px and up): one row — [hamburger]
 *     breadcrumb ........ [Bell]. (The hamburger is hidden on desktop.)
 *   - Phones (600px and below): hamburger on the left and Bell on the right
 *     share the first row, and the breadcrumb gets the full width below.
 * - The hamburger button is built in — it always calls openSidebar() and is
 *   only visible on tablet/mobile (desktop hides it via CSS). It stays in
 *   NORMAL document flow (scrolls with the page); only the sidebar itself
 *   is fixed/overlaying, so the hamburger never shifts when it opens.
 */
export default function Breadcrumb({ items = [] }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="pb-header-row">
      <button className="pb-hamburger" onClick={openSidebar} aria-label={t("Open menu")}>
        <FiMenu />
      </button>

      <div className="pb-breadcrumb">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <span className="pb-breadcrumb-sep">›</span>}
              {isLast || !item.path ? (
                <span className="pb-breadcrumb-current">{t(item.label)}</span>
              ) : (
                <span
                  className="pb-breadcrumb-link"
                  onClick={() => navigate(item.path)}
                >
                  {t(item.label)}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>

      <NotificationBell />
    </div>
  );
}