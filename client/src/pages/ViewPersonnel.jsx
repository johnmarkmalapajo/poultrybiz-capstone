import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiEdit2, FiUser, FiPhone, FiClock, FiCalendar, FiMapPin,
  FiFilter, FiChevronDown, FiPlus, FiBriefcase,
} from "react-icons/fi";
import {
  MdOutlineFactCheck, MdOutlineAssignmentTurnedIn, MdOutlineCancel, MdOutlineAccessTime,
} from "react-icons/md";
import PageLayout from "../components/PageLayout";
import "./ViewPersonnel.css";
// ── Inline mock data (frontend fallback until the API is wired) ──
const PERSONNEL = [
  {
    _id: "pm_seed_1", accountRole: "Admin", status: "Active",
    position: "Admin", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Ramon Cruz", contactNumber: "0917 555 1201", image: "" },
  },
  {
    _id: "pm_seed_2", accountRole: "Owner", status: "Active",
    position: "Owner", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Helen Yu", contactNumber: "0935 555 7788", image: "" },
  },
  {
    _id: "pm_seed_3", accountRole: "Farmer", position: "Layer House Attendant",
    dateHired: "2025-12-14", shiftHours: "6:00 AM – 2:00 PM", status: "Active",
    assignedWork: "Handles daily egg collection", remarks: "Handles daily egg collection",
    profile: { fullName: "Liza Mendoza", contactNumber: "0928 555 3345", image: "" },
  },
  {
    _id: "pm_seed_4", accountRole: "Farmer", position: "Feed & Inventory Handler",
    dateHired: "2026-01-08", shiftHours: "7:00 AM – 3:00 PM", status: "Active",
    assignedWork: "In charge of feed stock rotation", remarks: "In charge of feed stock rotation",
    profile: { fullName: "Paolo Lim", contactNumber: "0939 555 8890", image: "" },
  },
  {
    _id: "pm_seed_5", accountRole: "Farmer", position: "General Farm Worker",
    dateHired: "2026-02-11", shiftHours: "6:00 AM – 2:00 PM", status: "Active",
    assignedWork: "", remarks: "—",
    profile: { fullName: "Noel Aguilar", contactNumber: "0926 555 2201", image: "" },
  },
  {
    _id: "pm_seed_6", accountRole: "Farmer", position: "Sanitation & Waste Management",
    dateHired: "2025-09-19", shiftHours: "2:00 PM – 10:00 PM", status: "Inactive",
    assignedWork: "", remarks: "On extended leave",
    profile: { fullName: "Grace Fabella", contactNumber: "0917 555 6610", image: "" },
  },
  {
    _id: "pm_seed_7", accountRole: "Farmer", position: "Layer House Attendant",
    dateHired: "2026-03-22", shiftHours: "6:00 AM – 2:00 PM", status: "On Leave",
    assignedWork: "", remarks: "Approved leave until end of month",
    profile: { fullName: "Mateo Santos", contactNumber: "0905 555 4412", image: "" },
  },
];

// Date helpers — mock dates are stored as "days ago" offsets so the
// This Week / This Month / This Year filter works relative to today.
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateFromOffset = (n) => fmtDate(daysAgo(n));

const ATTENDANCE_BY_ID = {
  pm_seed_3: [
    { _id: "a1", timestamp: "08:00 AM", offset: 1,   timeIn: "7:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
    { _id: "a2", timestamp: "08:10 AM", offset: 4,   timeIn: "7:10 AM", timeOut: "5:00 PM", status: "Late",    remarks: "Delayed due to weather", taskCompleted: true },
    { _id: "a3", timestamp: "07:55 AM", offset: 18,  timeIn: "6:55 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
    { _id: "a4", timestamp: "08:00 AM", offset: 120, timeIn: "7:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  pm_seed_4: [
    { _id: "a1", timestamp: "07:50 AM", offset: 2,  timeIn: "6:50 AM", timeOut: "4:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
    { _id: "a2", timestamp: "--",       offset: 6,  timeIn: "--",      timeOut: "--",      status: "Absent",  remarks: "Sick Leave" },
    { _id: "a3", timestamp: "07:58 AM", offset: 40, timeIn: "6:58 AM", timeOut: "4:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  pm_seed_5: [
    { _id: "a1", timestamp: "08:05 AM", offset: 3,  timeIn: "8:05 AM", timeOut: "5:00 PM", status: "Late",    remarks: "Traffic", taskCompleted: true },
    { _id: "a2", timestamp: "08:00 AM", offset: 10, timeIn: "8:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  pm_seed_6: [
    { _id: "a1", timestamp: "08:00 AM", offset: 5, timeIn: "8:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  pm_seed_7: [],
};

const TASKS_BY_ID = {
  pm_seed_3: [
    { _id: "t1", offset: 1,  work: "Morning feeding (Cage 1-4)", assignedOffset: 2,  dueOffset: 0,  priority: "High",   status: "Completed" },
    { _id: "t2", offset: 4,  work: "Egg collection + sorting",   assignedOffset: 5,  dueOffset: 3,  priority: "Medium", status: "In Progress" },
    { _id: "t3", offset: 25, work: "Cage cleaning",              assignedOffset: 26, dueOffset: 22, priority: "Low",    status: "Pending" },
  ],
  pm_seed_4: [
    { _id: "t1", offset: 2,  work: "Vaccination (Flock B-002)",  assignedOffset: 4,  dueOffset: 1,  priority: "High",   status: "Completed" },
    { _id: "t2", offset: 35, work: "Health check round",         assignedOffset: 36, dueOffset: 33, priority: "Medium", status: "Pending" },
  ],
  pm_seed_5: [
    { _id: "t1", offset: 3, work: "Water line inspection",       assignedOffset: 5,  dueOffset: 1,  priority: "Medium", status: "In Progress" },
  ],
  pm_seed_6: [
    { _id: "t1", offset: 2,  work: "Stock count — feed sacks",   assignedOffset: 3,  dueOffset: 1,  priority: "Medium", status: "Completed" },
    { _id: "t2", offset: 6,  work: "Update inventory logbook",   assignedOffset: 7,  dueOffset: 5,  priority: "Low",    status: "In Progress" },
  ],
  pm_seed_7: [
    { _id: "t1", offset: 1,  work: "Coop repair (Section C)",    assignedOffset: 2,  dueOffset: 0,  priority: "High",   status: "Pending" },
  ],
};

// Sample tasks shown for any personnel not in the mock above (e.g., real
// backend ids before the /tasks endpoint is wired). Real API tasks override this.
const DEFAULT_TASKS = [
  { _id: "t1", offset: 1, work: "Morning farm rounds",   assignedOffset: 2, dueOffset: 0, priority: "High",   status: "In Progress" },
  { _id: "t2", offset: 4, work: "General cleaning duty", assignedOffset: 5, dueOffset: 3, priority: "Medium", status: "Pending" },
];

const getPersonnelById = (id) => PERSONNEL.find((p) => p._id === id) || null;
const getAttendanceById = (id) => ATTENDANCE_BY_ID[id] || [];
const getTasksById = (id) => TASKS_BY_ID[id] || DEFAULT_TASKS;

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/personnel`;

// ── From the Farmer's My Profile: Full Name, Contact Number, Image ──
const prof = (r) => (r ? r.profile || r.myProfile || r.user || r : {});
const getName = (r) => {
  const p = prof(r);
  return p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
};
const getContact = (r) => {
  const p = prof(r);
  return p.contactNumber || p.contact || p.phone || p.mobile || p.phoneNumber || "—";
};
const getImage = (r) => {
  const p = prof(r);
  return p.image || p.photo || p.avatar || p.profilePicture || p.profileImage || "";
};
const getInitials = (name) =>
  (name && name !== "—" ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
// ── Personnel-record fields (Admin-managed) ──
const getPosition = (r) => r?.position || r?.jobTitle || r?.designation || r?.role || "—";
const getShift = (r) => r?.shiftHours || r?.shift || r?.dutyHours || "—";
const getHired = (r) => r?.dateHired || r?.hired || (r?.createdAt ? String(r.createdAt).slice(0, 10) : "—");
const getStatus = (r) => r?.status || "Active";
const getAssignedWork = (r) => r?.assignedWork || r?.assignedTask || "—";
const getAccountRole = (r) => r?.accountRole || r?.userRole || r?.userType || r?.role || "";
const isOwnerAdmin = (r) => /owner|admin/i.test(getAccountRole(r));

export default function ViewPersonnel() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("attendance");

  // Toolbar controls (functional)
  const [timeRange, setTimeRange] = useState("month"); // week | month | year
  const [filterStatus, setFilterStatus] = useState("all");
  const [showTime, setShowTime] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const timeRef = useRef(null);
  const filterRef = useRef(null);

  const [record, setRecord] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reset the status filter when switching tabs (different option sets)
  useEffect(() => { setFilterStatus("all"); }, [activeTab]);

  // Owner/Admin has no Tasks tab — keep them on Attendance
  useEffect(() => { if (isOwnerAdmin(record)) setActiveTab("attendance"); }, [record]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e) => {
      if (timeRef.current && !timeRef.current.contains(e.target)) setShowTime(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    // Per-id fallbacks so each personnel shows ONLY their own data
    const mockRecord = getPersonnelById(id);
    const mockAttendance = getAttendanceById(id);
    const mockTasks = getTasksById(id);

    // QR check-ins saved by the QR Attendance modal (shared via localStorage)
    let qrAttendance = [];
    try {
      qrAttendance = (JSON.parse(localStorage.getItem("pb_attendance") || "{}")[id]) || [];
    } catch { qrAttendance = []; }

    // Personnel record (profile info comes from the Farmer's My Profile)
    fetch(`${API_BASE}/${id}`, { headers })
      .then((r) => r.json())
      .then((d) => {
        const rec = d && (d.record || d.data || d);
        setRecord(rec && (rec._id || rec.profile || rec.fullName || rec.name) ? rec : mockRecord);
      })
      .catch(() => setRecord(mockRecord))
      .finally(() => setLoading(false));

    // Attendance / work logs for this personnel
    fetch(`${API_BASE}/${id}/attendance`, { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setAttendance([...qrAttendance, ...(list.length ? list : mockAttendance)]);
      })
      .catch(() => setAttendance([...qrAttendance, ...mockAttendance]));

    // Tasks assigned to this personnel (by Owner/Admin)
    fetch(`${API_BASE}/${id}/tasks`, { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setTasks(list.length ? list : mockTasks);
      })
      .catch(() => setTasks(mockTasks));
  }, [id]);

  const statusBadge = (status) => (
    <span className={`badge ${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
  );

  const priorityBadge = (priority) =>
    priority ? (
      <span className={`badge prio-${String(priority).toLowerCase()}`}>{priority}</span>
    ) : (
      "—"
    );

  // ── Time-range filter (functional) ──
  const RANGE_DAYS = { week: 7, month: 31, year: 366 };
  const RANGE_LABEL = { week: "This Week", month: "This Month", year: "This Year" };
  const inRange = (offset) => Number(offset) <= (RANGE_DAYS[timeRange] ?? 366);

  // Status filter options depend on the active tab
  const ATTENDANCE_STATUSES = ["Present", "Absent", "Late"];
  const TASK_STATUSES = ["Pending", "In Progress", "Completed"];
  const filterOptions = activeTab === "attendance" ? ATTENDANCE_STATUSES : TASK_STATUSES;

  // Filtered, date-resolved views
  const attendanceView = attendance
    .filter((a) => inRange(a.offset))
    .filter((a) => filterStatus === "all" || a.status === filterStatus)
    .map((a) => ({ ...a, date: a.date || dateFromOffset(a.offset) }));

  const tasksView = tasks
    .filter((t) => inRange(t.offset))
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .map((t) => ({
      ...t,
      date: t.date || dateFromOffset(t.offset),
      assignedDate: t.assignedDate || (t.assignedOffset != null ? dateFromOffset(t.assignedOffset) : "—"),
      dueDate: t.dueDate || (t.dueOffset != null ? dateFromOffset(t.dueOffset) : "—"),
    }));

  // ── Attendance stats (reflect the selected time range) ──
  const rangedAttendance = attendance.filter((a) => inRange(a.offset));
  const present = rangedAttendance.filter((a) => a.status === "Present").length;
  const absent = rangedAttendance.filter((a) => a.status === "Absent").length;
  const late = rangedAttendance.filter((a) => a.status === "Late").length;
  const tasksCompleted = rangedAttendance.filter((a) => a.taskCompleted).length;

  const name = getName(record);
  const ownerAdmin = isOwnerAdmin(record);

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
        { label: "PERSONNEL AND MANPOWER", path: "/personnel-visitors/personnel" },
        { label: "VIEW PERSONNEL" },
      ]}
    >
        {/* Profile Card */}
        <div className="vp-profile-card">
          <div className="vp-profile-left">
            {getImage(record) ? (
              <img className="vp-avatar" src={getImage(record)} alt="" />
            ) : (
              <span className="vp-avatar vp-avatar-fallback">{getInitials(name)}</span>
            )}

            <div className="vp-profile-info">
              <div className="vp-name-row">
                <h1>{loading ? "Loading..." : name}</h1>
                {!ownerAdmin && statusBadge(getStatus(record))}
              </div>

              <div className="vp-profile-grid">
                <div>
                  <p><FiUser /> Position / Role</p>
                  <h4>{getPosition(record)}</h4>
                </div>
                <div>
                  <p><FiPhone /> Contact Number</p>
                  <h4>{getContact(record)}</h4>
                </div>
                {!ownerAdmin && (
                  <>
                    <div>
                      <p><FiClock /> Shift / Duty Hours</p>
                      <h4>{getShift(record)}</h4>
                    </div>
                    <div>
                      <p><FiCalendar /> Date Hired</p>
                      <h4>{getHired(record)}</h4>
                    </div>
                    <div>
                      <p><FiMapPin /> Status</p>
                      <h4>{statusBadge(getStatus(record))}</h4>
                    </div>
                    <div>
                      <p><FiBriefcase /> Assigned Work</p>
                      <h4>{getAssignedWork(record)}</h4>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <button className="vp-edit-btn" onClick={() => navigate(`/personnel-visitors/personnel/edit/${id}`)}>
            <FiEdit2 /> Edit Profile
          </button>
        </div>

        {/* Stats */}
        <div className="vp-stats-grid">
          <div className="vp-stat-card">
            <div className="vp-stat-icon green"><MdOutlineFactCheck /></div>
            <div><h2>{present}</h2><h4>Days Present</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon red"><MdOutlineCancel /></div>
            <div><h2>{absent}</h2><h4>Days Absent</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon orange"><MdOutlineAccessTime /></div>
            <div><h2>{late}</h2><h4>Days Late</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon blue"><MdOutlineAssignmentTurnedIn /></div>
            <div><h2>{tasksCompleted}</h2><h4>Tasks Completed</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
        </div>

        {/* Tabs + actions — on the page background (Quarantine/Isolation style) */}
        <div className="vp-table-top">
          <div className="vp-tabs">
            <button className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>
              Attendance
            </button>
            {!ownerAdmin && (
              <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>
                Tasks
              </button>
            )}
          </div>
          <div className="vp-table-actions">
            {/* Time range — functional */}
            <div className="vp-dd-wrap" ref={timeRef}>
              <button className="vp-dd-btn" onClick={() => { setShowTime((s) => !s); setShowFilter(false); }}>
                <FiCalendar /> {RANGE_LABEL[timeRange]} <FiChevronDown />
              </button>
              {showTime && (
                <div className="vp-dd-menu">
                  {["week", "month", "year"].map((r) => (
                    <button
                      key={r}
                      className={`vp-dd-item ${timeRange === r ? "active" : ""}`}
                      onClick={() => { setTimeRange(r); setShowTime(false); }}
                    >
                      {RANGE_LABEL[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status filter — functional (options depend on tab) */}
            <div className="vp-dd-wrap" ref={filterRef}>
              <button className="vp-dd-btn" onClick={() => { setShowFilter((s) => !s); setShowTime(false); }}>
                <FiFilter /> {filterStatus === "all" ? "Filter" : filterStatus} <FiChevronDown />
              </button>
              {showFilter && (
                <div className="vp-dd-menu">
                  <button
                    className={`vp-dd-item ${filterStatus === "all" ? "active" : ""}`}
                    onClick={() => { setFilterStatus("all"); setShowFilter(false); }}
                  >
                    All
                  </button>
                  {filterOptions.map((s) => (
                    <button
                      key={s}
                      className={`vp-dd-item ${filterStatus === s ? "active" : ""}`}
                      onClick={() => { setFilterStatus(s); setShowFilter(false); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === "tasks" && (
              <button
                className="vp-add-btn"
                onClick={() => navigate(`/personnel-visitors/personnel/${id}/tasks/add`)}
              >
                <FiPlus /> Add Tasks
              </button>
            )}
          </div>
        </div>

        {/* Table — flat wrapper (matches MortalityRecord's .mr-table-wrapper pattern):
            the wrapper itself IS the card (border/shadow) and holds the table +
            footer directly, with no extra flex-shrink-prone outer div. */}
        <div className="vp-table-wrapper">
          {activeTab === "attendance" ? (
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Attendance</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {attendanceView.length === 0 ? (
                  <tr><td colSpan="6" className="vp-empty">No attendance records for this range.</td></tr>
                ) : (
                  attendanceView.map((a, i) => (
                    <tr key={a._id || i}>
                      <td>{a.timestamp || "—"}</td>
                      <td>{a.date || "—"}</td>
                      <td>{a.timeIn || "—"}</td>
                      <td>{a.timeOut || "—"}</td>
                      <td>{statusBadge(a.status || "—")}</td>
                      <td>{a.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Work Assigned Today</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasksView.length === 0 ? (
                  <tr><td colSpan="7" className="vp-empty">No tasks for this range.</td></tr>
                ) : (
                  tasksView.map((t, i) => (
                    <tr key={t._id || i}>
                      <td>{t.date || "—"}</td>
                      <td>{t.work || t.task || "—"}</td>
                      <td>{t.assignedDate || "—"}</td>
                      <td>{t.dueDate || "—"}</td>
                      <td>{priorityBadge(t.priority)}</td>
                      <td>{statusBadge(t.status || "—")}</td>
                      <td>
                        <button
                          className="vp-row-edit"
                          title="Edit task"
                          onClick={() => navigate(`/personnel-visitors/personnel/${id}/tasks/edit/${t._id}`)}
                        >
                          <FiEdit2 />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          <div className="vp-table-footer">
            <span>Showing {activeTab === "attendance" ? attendanceView.length : tasksView.length} entries</span>
          </div>
        </div>

    </PageLayout>
  );
}