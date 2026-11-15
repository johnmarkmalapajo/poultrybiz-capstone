import Sidebar from "./Sidebar";
import Breadcrumb from "./Breadcrumb";
import "./PageLayout.css";

/**
 * PageLayout — the ONE reusable page shell used by every page in the app.
 *
 * Handles: main page container, content wrapper, page padding/margins,
 * scroll behavior, responsive spacing (desktop/tablet/mobile), and
 * breadcrumb placement. Every page that uses this automatically gets
 * identical layout — no per-page shell CSS needed.
 *
 * Usage:
 *   <PageLayout breadcrumbItems={[
 *     { label: "RECORDS", path: "/records" },
 *     { label: "MORTALITY RECORD" },
 *   ]}>
 *     ... page-specific content (toolbar, table, form, cards, etc.) ...
 *   </PageLayout>
 *
 * `background` (optional): pass the page's own background color if it
 * differs from the app default — layout/spacing/breadcrumb stay identical
 * either way, only the color changes (colors are intentionally NOT
 * standardized by this component, per the "don't change colors" rule).
 *
 * `color` (optional): pass the page's own base text color if it previously
 * set one on its page shell (some pages relied on inheriting this on child
 * elements that don't declare their own color).
 *
 * `className` (optional): extra class on the outer `.pl-page` div, in case
 * a specific page still needs a narrow, page-specific hook for something
 * that isn't layout (kept to an absolute minimum).
 *
 * `titleBadge` (optional): a small tag shown right after the page title in
 * the breadcrumb (e.g. the Dashboard's role badge). Pages that don't pass it
 * are unchanged.
 */
export default function PageLayout({ breadcrumbItems, titleBadge, background, color, className = "", children }) {
  const style = {};
  if (background) style.background = background;
  if (color) style.color = color;

  return (
    <div
      className={`pl-page ${className}`.trim()}
      style={Object.keys(style).length ? style : undefined}
    >
      <Sidebar />
      <div className="pl-main">
        <Breadcrumb items={breadcrumbItems} badge={titleBadge} />
        {children}
      </div>
    </div>
  );
}