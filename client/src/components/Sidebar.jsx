import { useLanguage } from "../i18n/LanguageContext";
import { useState, useEffect } from "react"
import "./Sidebar.css"
import { Link, useLocation, useNavigate } from "react-router-dom"
import sidelogo from "../assets/sidelogo.jpg"
import dashboardIcon from "../assets/dashboard.svg"
import recordsIcon from "../assets/records.svg"
import inventoryIcon from "../assets/inventory.svg"
import salesTransactionsIcon from "../assets/sales-transactions.svg"
import todoIcon from "../assets/todo.svg"
import settingsIcon from "../assets/settings.svg"
import logoutIcon from "../assets/logout.svg"
import userMenuIcon from "../assets/user.svg"
import userIcon from "../assets/donlogo.png"
import { useUser } from "../hooks/useUser"
import { FiX } from "react-icons/fi"
import { logout } from "../api/auth";

export function openSidebar() {
  window.dispatchEvent(new CustomEvent("open-sidebar"));
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profileVersion, setProfileVersion] = useState(0);
  const { user, canSeeFinancials, canViewPersonnel } = useUser();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setProfileVersion((v) => v + 1);
    window.addEventListener("pb_user_updated", handler);
    return () => window.removeEventListener("pb_user_updated", handler);
  }, []);

  useState(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("open-sidebar", handler);
    return () => window.removeEventListener("open-sidebar", handler);
  });

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleLogoutConfirm = async () => {
  try {
    await logout();
  } catch (error) {
    console.error("Logout audit failed:", error);
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("pb_intended_path");
    navigate("/", { replace: true });
  }
};

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={closeMobile} />
      )}

      <div className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>

        <button className="sidebar-close-btn" onClick={closeMobile}>
          <FiX />
        </button>

        <div className="logo-title">
          <img src={sidelogo} alt="Poultrybriz Logo" className="sidelogo" />
          <div className="brand-text">
            <p className="company">Egginear Agri-Poultry Solutions</p>
            <h2>POULTRYBIZ</h2>
            <p className="location">Poras, Boac, Marinduque</p>
          </div>
        </div>

        <ul>
          <li className={isActive("/dashboard") ? "active" : "secondary"}>
            <Link to="/dashboard" className="nav-link" onClick={closeMobile}>
              <img src={dashboardIcon} alt="Dashboard" className="menu-icon" />
              {t("Dashboard")}
            </Link>
          </li>

          <li className={isActive("/records") ? "active" : "secondary"}>
            <Link to="/records" className="nav-link" onClick={closeMobile}>
              <img src={recordsIcon} alt="Records" className="menu-icon" />
              {t("Records")}
            </Link>
          </li>

          <li className={isActive("/inventory") ? "active" : "secondary"}>
            <Link to="/inventory" className="nav-link" onClick={closeMobile}>
              <img src={inventoryIcon} alt="Inventory" className="menu-icon" />
              {t("Inventory")}
            </Link>
          </li>

          {canSeeFinancials && (
            <li className={isActive("/sales-transactions") ? "active" : "secondary"}>
              <Link to="/sales-transactions" className="nav-link" onClick={closeMobile}>
                <img src={salesTransactionsIcon} alt="Sales and Transactions" className="menu-icon" />
                {t("Sales and Transactions")}
              </Link>
            </li>
          )}

          {canViewPersonnel && (
            <li className={isActive("/personnel-visitors") ? "active" : "secondary"}>
              <Link to="/personnel-visitors" className="nav-link" onClick={closeMobile}>
                <img src={userMenuIcon} alt="Personnel" className="menu-icon" />
                {t("Personnel and Visitors")}
              </Link>
            </li>
          )}

          <li className={isActive("/todo") || isActive("/owner/todo") ? "active" : "secondary"}>
            <Link to={canViewPersonnel ? "/owner/todo" : "/todo"} className="nav-link" onClick={closeMobile}>
              <img src={todoIcon} alt="To Do" className="menu-icon" />
              {t("To Do")}
            </Link>
          </li>

          <li className="divider"></li>

          <li className={isActive("/settings") ? "active" : "secondary"}>
            <Link to="/settings" className="nav-link" onClick={closeMobile}>
              <img src={settingsIcon} alt="Settings" className="menu-icon" />
              {t("Settings")}
            </Link>
          </li>

          <li className="secondary" onClick={() => setShowLogoutModal(true)} style={{ cursor: "pointer" }}>
            <img src={logoutIcon} alt="Logout" className="menu-icon" />
            {t("Logout")}
          </li>
        </ul>

        <div
          className="user"
          onClick={() => { navigate("/settings?view=profile", { state: { fromSidebar: true } }); closeMobile(); }}
          style={{ cursor: "pointer" }}
          title={t("View Profile")}
        >

          <div className="user-info">
            <img
              src={user.avatar ? (user.avatar.startsWith("http") ? user.avatar : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${user.avatar}`) : userIcon}
              alt="User"
              className="user-icon"
            />
            <div className="user-details">
              <p><strong>{user.name || "User"}</strong></p>
              <span>
                  {t(user.role === "Owner" ? "Owner" : user.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showLogoutModal && (
        <div className="logout-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="logout-title">{t("Log Out")}</h3>
            <p className="logout-message">{t("Are you sure you want to log out of your account?")}</p>
            <div className="logout-actions">
              <button className="logout-btn-cancel" onClick={() => setShowLogoutModal(false)}>
                {t("Cancel")}
              </button>
              <button className="logout-btn-confirm" onClick={handleLogoutConfirm}>
                {t("Log Out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar