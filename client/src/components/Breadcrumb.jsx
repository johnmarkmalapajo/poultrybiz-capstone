import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { openSidebar } from "./Sidebar";
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
 * - The hamburger button is built in — it always calls openSidebar() and is
 *   only visible on tablet/mobile (desktop hides it via CSS). It stays in
 *   NORMAL document flow (scrolls with the page); only the sidebar itself
 *   is fixed/overlaying, so the hamburger never shifts when it opens.
 */
export default function Breadcrumb({ items = [] }) {
  const navigate = useNavigate();

  return (
    <div className="pb-breadcrumb">
      <button className="pb-hamburger" onClick={openSidebar} aria-label="Open menu">
        <FiMenu />
      </button>

      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <span className="pb-breadcrumb-sep">›</span>}
            {isLast || !item.path ? (
              <span className="pb-breadcrumb-current">{item.label}</span>
            ) : (
              <span
                className="pb-breadcrumb-link"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}