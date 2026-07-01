import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiDownload, FiEye, FiArchive, FiMenu, FiMaximize, FiX,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { MdGroups, MdHowToReg, MdEventNote } from "react-icons/md";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Visitors.css";

const API_BASE = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/visitors`;

/* ── Inline mock (one record per unique visitor) ── */
const VISITORS = [
  { _id: "v1", fullName: "Dr. Ramon Cruz",  address: "Brgy. Poras, Boac, Marinduque",  affiliation: "Provincial Veterinary Office", contactNumber: "0917 555 1201", visitCount: 4, lastVisitOffset: 1,  archived: false },
  { _id: "v2", fullName: "Liza Mendoza",    address: "Brgy. Balimbing, Mogpog",        affiliation: "AgriFeeds Supplier Inc.",      contactNumber: "0928 555 3345", visitCount: 2, lastVisitOffset: 3,  archived: false },
  { _id: "v3", fullName: "Engr. Paolo Lim", address: "Sta. Cruz, Marinduque",           affiliation: "DA Region IV-B",               contactNumber: "0939 555 8890", visitCount: 1, lastVisitOffset: 8,  archived: false },
  { _id: "v4", fullName: "Carla Reyes",     address: "Brgy. Tabigue, Gasan",            affiliation: "PoultryVet Diagnostics",       contactNumber: "0916 555 7723", visitCount: 3, lastVisitOffset: 12, archived: false },
  { _id: "v5", fullName: "Mateo Santos",    address: "Brgy. Ipil, Boac",                affiliation: "Independent Buyer",            contactNumber: "0905 555 4412", visitCount: 1, lastVisitOffset: 20, archived: false },
  { _id: "v6", fullName: "Grace Fabella",   address: "Brgy. Malusak, Boac",             affiliation: "LGU Agriculture Office",       contactNumber: "0917 555 6610", visitCount: 2, lastVisitOffset: 0,  archived: false },
  { _id: "v7", fullName: "Noel Aguilar",    address: "Brgy. Bangbang, Sta. Cruz",       affiliation: "FeedMix Trading",              contactNumber: "0926 555 2201", visitCount: 5, lastVisitOffset: 2,  archived: false },
  { _id: "v8", fullName: "Dr. Helen Yu",    address: "Brgy. Tampus, Buenavista",        affiliation: "Marinduque Vet Clinic",        contactNumber: "0935 555 7788", visitCount: 1, lastVisitOffset: 5,  archived: false },
  { _id: "v9", fullName: "Rico Pascual",    address: "Brgy. Laylay, Boac",              affiliation: "Cold Chain Logistics",         contactNumber: "0918 555 3030", visitCount: 3, lastVisitOffset: 4,  archived: false },
  { _id: "v10", fullName: "Anna Borja",     address: "Brgy. Banuyo, Gasan",             affiliation: "AgriTech Solutions",           contactNumber: "0927 555 9912", visitCount: 2, lastVisitOffset: 9,  archived: false },
  { _id: "v11", fullName: "Felix Manlapaz", address: "Brgy. Hinapulan, Mogpog",         affiliation: "Egg Distributor Co.",          contactNumber: "0936 555 4567", visitCount: 6, lastVisitOffset: 1,  archived: false },
  { _id: "v12", fullName: "Joy Dela Peña",  address: "Brgy. Maligaya, Sta. Cruz",       affiliation: "DA Region IV-B",               contactNumber: "0919 555 8123", visitCount: 1, lastVisitOffset: 14, archived: false },
  { _id: "v13", fullName: "Samuel Ong",     address: "Brgy. Caganhao, Boac",            affiliation: "Poultry Equipment Supply",     contactNumber: "0928 555 6754", visitCount: 2, lastVisitOffset: 6,  archived: false },
  { _id: "v14", fullName: "Teresa Villar",  address: "Brgy. Tarug, Mogpog",             affiliation: "Independent Buyer",            contactNumber: "0937 555 2390", visitCount: 1, lastVisitOffset: 18, archived: false },
  { _id: "v15", fullName: "Mark Lozano",    address: "Brgy. Bagtingon, Buenavista",     affiliation: "BioSecure Services",           contactNumber: "0916 555 1145", visitCount: 4, lastVisitOffset: 3,  archived: false },
];

/* ── Tolerant accessors (adjust to your API field names) ── */
const getId = (r) => r._id || r.id;
const getName = (r) => r.fullName || r.name || "—";
const getAddress = (r) => r.address || "—";
const getAffiliation = (r) => r.affiliation || r.company || r.organization || "—";
const getContact = (r) => r.contactNumber || r.contact || "—";
const isArchived = (r) => Boolean(r.archived);

export default function Visitors() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // QR
  const [qrOpen, setQrOpen] = useState(false);
  const CHECKIN_URL = (typeof window !== "undefined" ? window.location.origin : "") + "/visitor/check-in";
  const STATION_QR =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(CHECKIN_URL);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    fetch(API_BASE, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setRecords(list.length ? list : VISITORS);
      })
      .catch(() => setRecords(VISITORS))
      .finally(() => setLoading(false));
  }, []);

  // Only unique, non-archived visitors in the main roster
  const matches = (r) => {
    const q = search.toLowerCase();
    return (
      getName(r).toLowerCase().includes(q) ||
      getAffiliation(r).toLowerCase().includes(q) ||
      getAddress(r).toLowerCase().includes(q) ||
      getContact(r).toLowerCase().includes(q)
    );
  };
  const visitors = records.filter((r) => !isArchived(r)).filter(matches);

  // Stats
  const totalVisitors = records.filter((r) => !isArchived(r)).length;
  const visitsThisMonth = records
    .filter((r) => !isArchived(r))
    .reduce((sum, r) => sum + (Number(r.visitCount) || 0), 0);
  const visitsToday = records.filter((r) => !isArchived(r) && Number(r.lastVisitOffset) === 0).length;

  // Export current view to CSV
  const exportCSV = () => {
    const headers = ["Full Name", "Address", "Affiliation", "Contact Number"];
    const rows = visitors.map((r) => [getName(r), getAddress(r), getAffiliation(r), getContact(r)]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "visitors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vm-page">
      <Sidebar />

      <main className="vm-main">
        {/* Breadcrumb */}
        <div className="vm-breadcrumb">
          <button className="vm-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>
          <span className="breadcrumb-link" onClick={() => navigate("/personnel-visitors")}>PERSONNEL AND VISITORS</span>
          <span>›</span>
          <span className="breadcrumb-current">VISITORS</span>
        </div>

        {/* Header */}
        <div className="vm-header">
          <div>
            <h1>Visitors Management</h1>
            <p>Registered farm visitors and their visit logs.</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="vm-stats">
          <div className="vm-stat">
            <span className="vm-stat-icon gold"><MdGroups /></span>
            <div><h2>{totalVisitors}</h2><h4>Total Visitors</h4></div>
          </div>
          <div className="vm-stat">
            <span className="vm-stat-icon green"><MdEventNote /></span>
            <div><h2>{visitsThisMonth}</h2><h4>Visits This Month</h4></div>
          </div>
          <div className="vm-stat">
            <span className="vm-stat-icon blue"><MdHowToReg /></span>
            <div><h2>{visitsToday}</h2><h4>Visits Today</h4></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="vm-toolbar">
          <div className="search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search visitors by name, affiliation, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-btn-group">
            <button className="toolbar-btn" onClick={() => setQrOpen(true)}><BsQrCode /> QR Generation</button>
            <button className="toolbar-btn" onClick={exportCSV}><FiDownload /> Export</button>
          </div>
        </div>

        {/* Table */}
        <div className="vm-table-card">
          <div className="vm-table-wrapper">
            <table className="vm-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Address</th>
                  <th>Affiliation / Company</th>
                  <th>Contact Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="empty-state">Loading visitors...</td></tr>
                ) : visitors.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      <div className="empty-content">
                        <FiMaximize />
                        <h3>No visitors found</h3>
                        <p>Visitors appear here automatically once they register by scanning the farm QR code.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visitors.map((r) => (
                    <tr key={getId(r)}>
                      <td className="vm-name">{getName(r)}</td>
                      <td>{getAddress(r)}</td>
                      <td>{getAffiliation(r)}</td>
                      <td>{getContact(r)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn view" title="View" onClick={() => navigate(`/personnel-visitors/visitors/view/${getId(r)}`)}><FiEye /></button>
                          <button className="action-btn archive" title="Archive"><FiArchive /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="vm-table-footer">Showing {visitors.length} visitors</div>
        </div>
      </main>

      {/* ── SHARED FARM QR MODAL ── */}
      {qrOpen && (
        <div className="qr-overlay" onClick={() => setQrOpen(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div className="qr-modal-title"><BsQrCode /><h3>Visitor QR Code</h3></div>
              <button className="qr-close" onClick={() => setQrOpen(false)} aria-label="Close"><FiX /></button>
            </div>

            <p className="qr-modal-sub">
              One shared QR code for the whole farm — displayed at the entrance.
              Every visitor scans this same QR to open the registration form.
            </p>

            <div className="qr-station">
              <div className="qr-frame">
                <img className="qr-station-img" src={STATION_QR} alt="Visitor QR code" loading="lazy" />
                <span className="qr-frame-caption">Farm Entrance QR</span>
              </div>
              <button className="qr-download-btn" onClick={() => window.open(STATION_QR, "_blank", "noopener,noreferrer")}>
                <FiDownload /> Download QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}