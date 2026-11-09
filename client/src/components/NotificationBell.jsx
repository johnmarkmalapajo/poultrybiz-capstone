import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import { useLanguage } from "../i18n/LanguageContext";
import { useUser } from "../hooks/useUser";
import { getUnreadCount, refresh as refreshNotifs, subscribe as subscribeNotifs } from "../notifStore";
import "./NotificationBell.css";

/**
 * NotificationBell — the header entry point to the existing Notifications page.
 *
 * It owns no notification data. It reads the same shared store the
 * Notifications page and the Dashboard alerts use (notifStore), so the badge is
 * always the number of unread notifications that role may see and it updates
 * the moment anything is marked read, marked all read, or deleted. Opening it
 * simply navigates to the existing /notifications route, where every category,
 * filter, read/unread action and role rule keeps working as before.
 *
 * This component also takes over the store refresh + subscription that the
 * Sidebar's Notifications item used to do, so the count still loads on every
 * page. refresh() shares one in-flight request, so no extra API calls are made.
 */
export default function NotificationBell() {
  const { t } = useLanguage();
  const { role } = useUser();
  const location = useLocation();
  const [unread, setUnread] = useState(() => getUnreadCount(role));

  useEffect(() => {
    let active = true;
    const update = () => { if (active) setUnread(getUnreadCount(role)); };
    update();
    refreshNotifs(role).then(update);
    const unsubscribe = subscribeNotifs(update);
    return () => { active = false; unsubscribe(); };
  }, [role]);

  const onNotifications = location.pathname === "/notifications";
  const label = unread > 0 ? `${t("Notifications")} (${unread})` : t("Notifications");

  return (
    <Link
      to="/notifications"
      className={`pb-bell${onNotifications ? " pb-bell-active" : ""}`}
      aria-label={label}
      title={t("Notifications")}
      aria-current={onNotifications ? "page" : undefined}
    >
      <FiBell aria-hidden="true" />
      {unread > 0 && (
        <span className="pb-bell-badge" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}