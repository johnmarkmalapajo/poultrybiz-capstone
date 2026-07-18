import { useState, useEffect } from "react"
import "./Sidebar.css"
import { Link, useLocation, useNavigate } from "react-router-dom"
import sidelogo from "../assets/sidelogo.jpg"
import dashboardIcon from "../assets/dashboard.svg"
import recordsIcon from "../assets/records.svg"
import inventoryIcon from "../assets/inventory.svg"
import salesTransactionsIcon from "../assets/sales-transactions.svg"
import todoIcon from "../assets/todo.svg"
import notificationsIcon from "../assets/notifications.svg"
import settingsIcon from "../assets/settings.svg"
import logoutIcon from "../assets/logout.svg"
import userMenuIcon from "../assets/user.svg"
import userIcon from "../assets/donlogo.png"
import { useUser } from "../hooks/useUser"
import { getUnreadCount, subscribe as subscribeNotifs } from "../notifStore"
import { FiX } from "react-icons/fi"

// Global event-based approach — more reliable than reassigning a variable
export function openSidebar() {
  window.dispatchEvent(new CustomEvent("open-sidebar"));
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, canSeeFinancials, canViewPersonnel } = useUser();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(() => getUnreadCount(role));

  // Keep the notifications badge in sync (updates when items are marked read,
  // and only counts notifications relevant to THIS user's role — e.g. a
  // Farmer never sees Admin-only alerts like pending account approvals).
  useEffect(() => {
    const update = () => setUnread(getUnreadCount(role));
    update();
    return subscribeNotifs(update);
  }, [role]);

  // Listen for the global open event
  useState(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-sidebar", handler);
    return () => window.removeEventListener("open-sidebar", handler);
  });

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={closeMobile} />
      )}

      <div className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>

        {/* Close button — phone only */}
        <button className="sidebar-close-btn" onClick={closeMobile}>
          <FiX />
        </button>

        <p className="company">Egginear Agri-Poultry Solutions</p>
        <div className="logo-title">
          <img src={sidelogo} alt="Poultrybriz Logo" className="sidelogo" />
          <h2>POULTRYBIZ</h2>
        </div>
        <p className="location">Poras, Boac, Marinduque</p>

        <ul>
          <li className={isActive("/dashboard") ? "active" : "secondary"}>
            <Link to="/dashboard" className="nav-link" onClick={closeMobile}>
              <img src={dashboardIcon} alt="Dashboard" className="menu-icon" />
              Dashboard
            </Link>
          </li>

          <li className={isActive("/records") ? "active" : "secondary"}>
            <Link to="/records" className="nav-link" onClick={closeMobile}>
              <img src={recordsIcon} alt="Records" className="menu-icon" />
              Records
            </Link>
          </li>

          <li className={isActive("/inventory") ? "active" : "secondary"}>
            <Link to="/inventory" className="nav-link" onClick={closeMobile}>
              <img src={inventoryIcon} alt="Inventory" className="menu-icon" />
              Inventory
            </Link>
          </li>

          {canSeeFinancials && (
            <li className={isActive("/sales-transactions") ? "active" : "secondary"}>
              <Link to="/sales-transactions" className="nav-link" onClick={closeMobile}>
                <img src={salesTransactionsIcon} alt="Sales and Transactions" className="menu-icon" />
                Sales & Transactions
              </Link>
            </li>
          )}

          {/* Personnel & Visitors — hidden from Farmer */}
          {canViewPersonnel && (
            <li className={isActive("/personnel-visitors") ? "active" : "secondary"}>
              <Link to="/personnel-visitors" className="nav-link" onClick={closeMobile}>
                <img src={userMenuIcon} alt="Personnel" className="menu-icon" />
                Personnel and Visitors
              </Link>
            </li>
          )}

          <li className={isActive("/todo") || isActive("/admin/todo") ? "active" : "secondary"}>
            <Link to={canViewPersonnel ? "/admin/todo" : "/todo"} className="nav-link" onClick={closeMobile}>
              <img src={todoIcon} alt="To Do" className="menu-icon" />
              To Do
            </Link>
          </li>

          <li className={isActive("/notifications") ? "active" : "secondary"}>
            <Link to="/notifications" className="nav-link" onClick={closeMobile}>
              <img src={notificationsIcon} alt="Notifications" className="menu-icon" />
              Notifications
              {unread > 0 && (
                <span
                  className="notif-badge"
                  style={{
                    marginLeft: "auto",
                    background: "#d94f4f",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "'Poppins', sans-serif",
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "10px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                    lineHeight: 1,
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </li>

          <li className="divider"></li>

          <li className={isActive("/settings") ? "active" : "secondary"}>
            <Link to="/settings" className="nav-link" onClick={closeMobile}>
              <img src={settingsIcon} alt="Settings" className="menu-icon" />
              Settings
            </Link>
          </li>

          <li className="secondary" onClick={() => setShowLogoutModal(true)} style={{ cursor: "pointer" }}>
            <img src={logoutIcon} alt="Logout" className="menu-icon" />
            Logout
          </li>
        </ul>

        <div
          className="user"
          onClick={() => { navigate("/settings?view=profile", { state: { fromSidebar: true } }); closeMobile(); }}
          style={{ cursor: "pointer" }}
          title="View Profile"
        >
          <div className="user-info">
            <img src={userIcon} alt="User" className="user-icon" />
            <div className="user-details">
              <p><strong>{user.name || "Don Mark Dela Cruz"}</strong></p>
              <span>{user.role || "Egginear Poultry Solutions"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="logout-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="logout-title">Log Out</h3>
            <p className="logout-message">Are you sure you want to log out of your account?</p>
            <div className="logout-actions">
              <button className="logout-btn-cancel" onClick={() => setShowLogoutModal(false)}>
                Cancel
              </button>
              <button className="logout-btn-confirm" onClick={handleLogoutConfirm}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar