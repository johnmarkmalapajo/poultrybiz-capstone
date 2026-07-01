import "./Topbar.css"
import magnifyingGlass from "../assets/magnifying-glass.svg"
import { FiMenu } from "react-icons/fi"
import { openSidebar } from "./Sidebar"

function Topbar({ searchValue = "", onSearchChange, searchPlaceholder = "Search...", hideSearch = false }) {
  return (
    <div className="topbar">
      {/* Hamburger — phone only, top-left of topbar */}
      <button className="topbar-hamburger" onClick={openSidebar} aria-label="Open menu">
        <FiMenu />
      </button>

      {!hideSearch && (
        <div className="search-container">
          <img src={magnifyingGlass} alt="Search" className="search-icon" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
          />
        </div>
      )}
    </div>
  )
}

export default Topbar