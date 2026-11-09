import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiEdit2, FiUser, FiPhone, FiClock, FiCalendar, FiMapPin,
  FiFilter, FiChevronDown, FiPlus, FiToggleLeft, FiToggleRight,
} from "react-icons/fi";
import {
  MdOutlineFactCheck, MdOutlineAssignmentTurnedIn, MdOutlineCancel, MdOutlineAccessTime,
} from "react-icons/md";
import { getFarmInfo } from "../api/profile";
import PageLayout from "../components/PageLayout";
import "./ViewPersonnel.css";
import "./ToDo.css";
import "../components/ProofOfCompletionModal.css";
import { getPersonnel, getPersonnelAttendance, getPersonnelTasks, getPersonnelTaskHistory } from "../api/personnelManpower";
import { listPersonalTodos } from "../api/todo";
import { assignTask, addPersonalTodo, updateAssignedTaskById } from "../todoStore";
import { getAccessibleCategories } from "../moduleRegistry";
import { useUser } from "../hooks/useUser";
import { useLanguage } from "../i18n/LanguageContext";
import { API_BASE } from "../api/client";
import { FiImage, FiX } from "react-icons/fi";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";

// Estimated Duration is a distinct concept from Due Date: how long a task
// is expected to take, not a deadline. Applies to every category.
function formatEstimatedDuration(est) {
  if (!est || est.value == null) return "—";
  const unit = est.unit === "hours"
    ? (est.value === 1 ? "hr" : "hrs")
    : (est.value === 1 ? "min" : "mins");
  return `${est.value} ${unit}`;
}

// Date Created is backend-generated and immutable -- this is only a
// preview of what the Owner will see once the task actually saves (the
// real timestamp is set server-side at that moment). This modal is only
// ever used to add a new task (editing happens on the Edit Task page), so
// it always previews today's Philippine calendar date.
function phTodayDisplay() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Task History's "Completion Details" column shows remarks inline up to
// this many characters before collapsing behind a "View More" toggle.
const REMARKS_PREVIEW_LENGTH = 80;

// Task History's "Date Completed" and "Submission Time" columns are both
// derived from the occurrence's `submittedAt` -- the real completion
// instant -- rendered in Philippine time, never from occurrenceDate (which,
// for a Secondary task, can be set the first time the Farmer ever loads
// it, not the day it's actually completed) and never from Date Created.
function formatPHDateCompleted(submittedAt) {
  if (!submittedAt) return "—";
  try {
    const d = new Date(submittedAt);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return "—";
  }
}
function formatPHSubmissionTime(submittedAt) {
  if (!submittedAt) return "—";
  try {
    const d = new Date(submittedAt);
    if (isNaN(d)) return "—";
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return "—";
  }
}

const prof = (r) => {
  if (!r) return {};

  if (r.user && typeof r.user === "object") {
    return r.user;
  }

  return r.profile || r.myProfile || r;
};

const getName = (r) => {
  const p = prof(r);
  return (
    p.fullName ||
    p.name ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    "—"
  );
};

const getContact = (r) => {
  const p = prof(r);
  return (
    p.contactNumber ||
    p.contact ||
    p.phone ||
    p.mobile ||
    p.phoneNumber ||
    "—"
  );
};

const getEmail = (r) => {
  const p = prof(r);
  return p.email || p.emailAddress || "—";
};

const getImage = (r) => {
  const p = prof(r);

  const avatar =
    p.avatar ||
    p.profilePicture ||
    p.profileImage ||
    p.image ||
    p.photo;

  if (!avatar) return "";

  return avatar.startsWith("http")
    ? avatar
    : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${avatar}`;
};
const getInitials = (name) =>
  (name && name !== "—" ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const getPosition = (r) => r?.position || r?.jobTitle || r?.designation || r?.role || "—";
const getShift = (r) => r?.shiftHours || r?.shift || r?.dutyHours || "—";
const getHired = (r) => {const date = r?.dateHired || r?.hired || r?.createdAt; if (!date) return "—"; return new Date(date).toLocaleDateString("en-CA");
};const getStatus = (r) => r?.status || "Active";
const getAccountRole = (r) => r?.accountRole || r?.userRole || r?.userType || r?.role || r?.user?.role || r?.profile?.role || "";

export default function ViewPersonnel() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { isOwner, canSeeFinancials, canViewPersonnel, user: currentUser } = useUser();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("attendance");

  const [timeRange, setTimeRange] = useState("month");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showTime, setShowTime] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const timeRef = useRef(null);
  const filterRef = useRef(null);

  const [record, setRecord] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [personalTasksForRecord, setPersonalTasksForRecord] = useState([]);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmLogo: "" });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "", type: "", due: "", category: "Secondary",
    estimatedDurationValue: "", estimatedDurationUnit: "minutes",
  });
  const [savingTask, setSavingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Permanent Primary/Secondary task completion history (Personnel module,
  // section 7 of the To Do redesign). Kept separate from `tasks` above
  // since it is occurrence-based history, not the live task list.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyCategory, setHistoryCategory] = useState("All");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [photoViewer, setPhotoViewer] = useState(null); // { url, taskName, occurrenceDate }
  // Which Task History rows have their remarks expanded past the preview
  // length -- keyed by occurrence _id, so each row's expand state is
  // independent of every other row's.
  const [expandedRemarks, setExpandedRemarks] = useState(() => new Set());
  const toggleRemarksExpanded = (occurrenceId) => {
    setExpandedRemarks((prev) => {
      const next = new Set(prev);
      if (next.has(occurrenceId)) next.delete(occurrenceId);
      else next.add(occurrenceId);
      return next;
    });
  };
  const historyActiveFilterCount =
    (historyCategory !== "All" ? 1 : 0) + (historyFrom ? 1 : 0) + (historyTo ? 1 : 0);
  const clearHistoryFilters = () => { setHistoryCategory("All"); setHistoryFrom(""); setHistoryTo(""); };

  const targetRole = getAccountRole(record);
  const isTargetOwner = /^owner$/i.test(targetRole);
  const isSelfRecord = String(record?.user?._id) === String(currentUser?.id);
  const canManageTasks = isSelfRecord || isOwner;
  const canAddTask = isOwner;
  const showTaskActionsColumn = true;

  useEffect(() => { setFilterStatus("all"); }, [activeTab]);

  useEffect(() => { if (!canManageTasks) setActiveTab("attendance"); }, [record, canManageTasks]);

  useEffect(() => {
    const handle = (e) => {
      if (timeRef.current && !timeRef.current.contains(e.target)) setShowTime(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");

    getPersonnel(id)
      .then((d) => {
        const rec = d && (d.record || d.data || d);
        if (rec && (rec._id || rec.profile || rec.fullName || rec.name)) setRecord(rec);
        else setError(tr("Personnel record not found."));
      })
      .catch((err) => setError(tr(err?.message || "Couldn't load this personnel record.")))
      .finally(() => setLoading(false));

    getPersonnelAttendance(id)
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setAttendance(list);
      })
      .catch(() => setAttendance([]));

    refreshAssignedTasksForRecord();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAssignedTasksForRecord = () => {
    getPersonnelTasks(id)
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setAssignedTasks(list.filter((t) => !t.linkedPersonalTodo).map((t) => ({ ...t, source: "assigned" })));
      })
      .catch(() => setAssignedTasks([]));
  };

  useEffect(() => {
    refreshPersonalTasksForRecord();
  }, [record]);

  const refreshPersonalTasksForRecord = () => {
    const targetUserId = record?.user?._id;
    if (!targetUserId) { setPersonalTasksForRecord([]); return; }
    listPersonalTodos(targetUserId)
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setPersonalTasksForRecord(list.filter((t) => !t.archived).map((t) => ({ ...t, source: "personal" })));
      })
      .catch(() => setPersonalTasksForRecord([]));
  };

  useEffect(() => {
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const refreshHistory = () => {
    setHistoryLoading(true);
    setHistoryError("");
    const params = {};
    if (historyCategory !== "All") params.category = historyCategory;
    if (historyFrom) params.from = historyFrom;
    if (historyTo) params.to = historyTo;
    getPersonnelTaskHistory(id, params)
      .then((d) => setHistory(d?.records || []))
      .catch((err) => { setHistory([]); setHistoryError(err?.message || tr("Couldn't load task history.")); })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    if (activeTab !== "history") return;
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, historyCategory, historyFrom, historyTo]);

  const tasks = useMemo(
    () => [...assignedTasks, ...personalTasksForRecord],
    [assignedTasks, personalTasksForRecord]
  );

  const statusBadge = (status) => (
    <span className={`badge ${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
  );

  const RANGE_DAYS = { week: 7, month: 31, year: 366 };
  const RANGE_LABEL = { week: "This Week", month: "This Month", year: "This Year" };
  const inRange = (dateStr) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d)) return true;
    const days = (Date.now() - d.getTime()) / 86400000;
    return days <= (RANGE_DAYS[timeRange] ?? 366);
  };

  const ATTENDANCE_STATUSES = ["Present", "Absent", "Late"];
  const TASK_STATUSES = ["Pending", "Completed"];
  const filterOptions = activeTab === "attendance" ? ATTENDANCE_STATUSES : TASK_STATUSES;

  const attendanceView = attendance
    .filter((a) => inRange(a.date))
    .filter((a) => filterStatus === "all" || a.status === filterStatus);

  const tasksView = tasks
    .filter((t) => inRange(t.date))
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .map((t) => ({
      ...t,
      assignedDate: t.assignedDate || "—",
      dueDate: t.dueDate || "—",
    }));

  const personalTasksView = tasksView.filter((t) => t.source === "personal");
  const assignedTasksView = tasksView.filter((t) => t.source !== "personal");
  // Three independent tables (never one combined table): Primary,
  // Secondary, and Personal are rendered as separate sections below.
  const primaryTasksView = assignedTasksView.filter((t) => t.category === "Primary");
  const secondaryTasksView = assignedTasksView.filter((t) => t.category !== "Primary");

  // Each of the three task tables is a genuinely independent card with its
  // own pagination state -- never one shared pager for all three.
  const primaryPager = usePagination(primaryTasksView.length);
  const secondaryPager = usePagination(secondaryTasksView.length);
  const personalPager = usePagination(personalTasksView.length);
  useEffect(() => { primaryPager.setPage(1); }, [filterStatus, timeRange, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { secondaryPager.setPage(1); }, [filterStatus, timeRange, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { personalPager.setPage(1); }, [filterStatus, timeRange, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const primaryTasksPage = primaryTasksView.slice(primaryPager.startIndex, primaryPager.endIndex);
  const secondaryTasksPage = secondaryTasksView.slice(secondaryPager.startIndex, secondaryPager.endIndex);
  const personalTasksPage = personalTasksView.slice(personalPager.startIndex, personalPager.endIndex);

  const rangedAttendance = attendance.filter((a) => inRange(a.date));
  const present = rangedAttendance.filter((a) => a.status === "Present").length;
  const absent = rangedAttendance.filter((a) => a.status === "Absent").length;
  const late = rangedAttendance.filter((a) => a.status === "Late").length;
  const tasksCompleted = tasks .filter((t) => inRange(t.assignedDate || t.createdAt || t.dueDate)) .filter((t) => t.status === "Completed") .length;

  const name = getName(record);
  const canEditRecord = isOwner;

  const ASSIGN_TASK_HIDDEN_CATEGORIES = ["Sales Record", "Expense Record", "Personnel", "Visitor's Log", "User & Roles", "Archive", "Audit Logs"];
  const myAccessibleCategories = getAccessibleCategories({ isOwner, canSeeFinancials, canViewPersonnel })
    .filter((c) => !ASSIGN_TASK_HIDDEN_CATEGORIES.includes(c))
    .filter((c) => isTargetOwner || c !== "Flock Profile");
  const openTaskModal = () => {
    setTaskFormError("");
    setTaskForm({
      title: "", type: myAccessibleCategories[0] || "", due: "", category: "Secondary",
      estimatedDurationValue: "", estimatedDurationUnit: "minutes",
    });
    setTaskModalOpen(true);
  };
  const saveTaskModal = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    setTaskFormError("");
    // Estimated Duration applies to every category, including Primary.
    const estimatedDuration = taskForm.estimatedDurationValue
      ? { value: Number(taskForm.estimatedDurationValue), unit: taskForm.estimatedDurationUnit }
      : null;
    try {
      if (isSelfRecord) {
        await addPersonalTodo(currentUser?.id, {
          title: taskForm.title.trim(), type: taskForm.type, dueDate: taskForm.due, estimatedDuration,
        });
        refreshPersonalTasksForRecord();
      } else {
        await assignTask(id, {
          title: taskForm.title.trim(),
          type: taskForm.type,
          category: taskForm.category,
          estimatedDuration,
          // Due Date is never applicable to Primary tasks (perpetually
          // recurring); optional for Secondary.
          dueDate: taskForm.category === "Secondary" ? (taskForm.due || null) : null,
        }, currentUser?.name || "Owner");
        refreshAssignedTasksForRecord();
      }
      setTaskModalOpen(false);
    } catch (err) {
      setTaskFormError(err?.message || "Couldn't save this task. Please try again.");
    } finally {
      setSavingTask(false);
    }
  };
  const toggleAssignedTaskActive = async (t) => {
    try {
      await updateAssignedTaskById(id, t._id, { active: !(t.active !== false) });
      refreshAssignedTasksForRecord();
    } catch (err) {
      setError(err?.message || "Couldn't update this task. Please try again.");
    }
  };
  const pendingPersonalForModal = personalTasksForRecord.filter((t) => !t.archived && t.status === "Pending");
  const pendingAssignedForModal = assignedTasks.filter((t) => !t.archived && t.status === "Pending");

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
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}
        {loading && !record && (
          <p className="pb-loading-text">{tr("Loading personnel record...")}</p>
        )}

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
                {!isTargetOwner && statusBadge(getStatus(record))}
              </div>

              <div className="vp-profile-grid">
                <div>
                  <p><FiUser />{" "}{tr("Position / Role")}</p>
                  <h4>{getPosition(record)}</h4>
                </div>
                <div>
                  <p><FiPhone />{" "}{tr("Contact Number")}</p>
                  <h4>{getContact(record)}</h4>
                </div>
                {!isTargetOwner && (
                  <>
                    <div>
                      <p><FiClock />{" "}{tr("Shift / Duty Hours")}</p>
                      <h4>{getShift(record)}</h4>
                    </div>
                    <div>
                      <p><FiCalendar />{" "}{tr("Date Hired")}</p>
                      <h4>{getHired(record)}</h4>
                    </div>
                    <div>
                      <p><FiMapPin />{" "}{tr("Status")}</p>
                      <h4>{statusBadge(getStatus(record))}</h4>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="vp-header-actions">
            {canEditRecord && (
              <button className="vp-edit-btn" onClick={() => navigate(`/personnel-visitors/personnel/edit/${id}`)}>
                <FiEdit2 />{" "}{tr("Edit Profile")}</button>
            )}
          </div>
        </div>

        <div className="vp-stats-grid">
          <div className="vp-stat-card">
            <div className="vp-stat-icon green"><MdOutlineFactCheck /></div>
            <div><h2>{present}</h2><h4>{tr("Days Present")}</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon red"><MdOutlineCancel /></div>
            <div><h2>{absent}</h2><h4>{tr("Days Absent")}</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon orange"><MdOutlineAccessTime /></div>
            <div><h2>{late}</h2><h4>{tr("Days Late")}</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
          <div className="vp-stat-card">
            <div className="vp-stat-icon blue"><MdOutlineAssignmentTurnedIn /></div>
            <div><h2>{tasksCompleted}</h2><h4>{tr("Tasks Completed")}</h4><p>{RANGE_LABEL[timeRange]}</p></div>
          </div>
        </div>

        <div className="vp-table-top">
          <div className="vp-tabs">
            <button className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>{tr("Attendance")}</button>
            {canManageTasks && (
              <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>{tr("Tasks")}</button>
            )}
            {canManageTasks && (
              <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>{tr("Task History")}</button>
            )}
          </div>
          <div className="vp-table-actions">
            {activeTab !== "history" && (
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
            )}

            {/* Single Filter button, above the table, reused for every tab
                -- Attendance/Tasks filter by status as before; Task History
                repurposes this same button+panel for Category/From/To
                instead of a second button or filter controls inside the
                table area. */}
            <div className="vp-dd-wrap" ref={filterRef}>
              <button className="vp-dd-btn" onClick={() => { setShowFilter((s) => !s); setShowTime(false); }}>
                <FiFilter />{" "}
                {activeTab === "history" ? tr("Filter") : (filterStatus === "all" ? tr("Filter") : filterStatus)}
                {activeTab === "history" && historyActiveFilterCount > 0 && (
                  <span className="todo-filter-count">{historyActiveFilterCount}</span>
                )}
                <FiChevronDown />
              </button>
              {showFilter && activeTab === "history" ? (
                <div className="vp-dd-menu vp-dd-menu-wide">
                  <div className="todo-filter-head">
                    <span>{tr("Filter")}</span>
                    <button className="todo-filter-clear" onClick={clearHistoryFilters}>{tr("Clear")}</button>
                  </div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">{tr("Category")}</label>
                    <select className="todo-select" value={historyCategory} onChange={(e) => setHistoryCategory(e.target.value)}>
                      <option value="All">{tr("All")}</option>
                      <option value="Primary">{tr("Primary")}</option>
                      <option value="Secondary">{tr("Secondary")}</option>
                    </select>
                  </div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">{tr("From")}</label>
                    <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                  </div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">{tr("To")}</label>
                    <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                  </div>
                </div>
              ) : showFilter ? (
                <div className="vp-dd-menu">
                  <button
                    className={`vp-dd-item ${filterStatus === "all" ? "active" : ""}`}
                    onClick={() => { setFilterStatus("all"); setShowFilter(false); }}
                  >{tr("All")}</button>
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
              ) : null}
            </div>

            {activeTab === "tasks" && (isSelfRecord || (canAddTask && !isTargetOwner)) && (
              <button
                className="vp-add-btn"
                onClick={openTaskModal}
              >
                <FiPlus /> {isSelfRecord ? "Add Task" : "Assign Task"}
              </button>
            )}
          </div>
        </div>

        {activeTab === "attendance" && (
        <div className="vp-table-wrapper">
            <table className="vp-table">
              <thead>
                <tr>
                  <th>{tr("Timestamp")}</th>
                  <th>{tr("Date")}</th>
                  <th>{tr("Time In")}</th>
                  <th>{tr("Time Out")}</th>
                  <th>{tr("Attendance")}</th>
                  <th>{tr("Remarks")}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceView.length === 0 ? (
                  <tr><td colSpan="6" className="vp-empty">{tr("No attendance records for this range.")}</td></tr>
                ) : (
                  attendanceView.map((a, i) => (
<tr key={a._id || i}>
  <td>
    {a.timeIn
      ? new Date(a.timeIn).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—"}
  </td>

  <td>
  {a.date
    ? new Date(a.date).toISOString().split("T")[0]
    : "—"}
</td>

  <td>
    {a.timeIn
      ? new Date(a.timeIn).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—"}
  </td>

  <td>
    {a.timeOut
      ? new Date(a.timeOut).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—"}
  </td>

  <td>{statusBadge(a.status || "—")}</td>
  <td>{a.remarks || "—"}</td>
</tr>
                  ))
                )}
              </tbody>
            </table>

          <div className="vp-table-footer">
            <span>{tr("Showing")}{" "}{attendanceView.length}{" "}{tr("entries")}</span>
          </div>
        </div>
        )}

        {activeTab === "tasks" && (
          <div className="vp-task-sections">
            {/* Three genuinely independent card containers -- never one
                combined table, never a shared card, and the heading for
                each is a SIBLING of its table container (rendered outside
                the card, in its own wrapping group), never a child of it --
                the heading must never be enclosed by the table's own
                border. Each card is its own TableSection (own border/
                rounded corners via the reused todo-table-wrapper class),
                its own TableScroll (independent horizontal scroll), and
                its own TablePagination (independent paging) -- the same
                shared components AdminTodo.jsx already uses, applied three
                times over. Primary and Secondary only ever apply to a
                Farmer -- the Owner does not assign these to themselves
                through the Personnel module, so when the selected record
                belongs to the Owner, neither group (not even an empty one)
                is rendered at all. */}
            {!isTargetOwner && (
              <div className="vp-task-group">
                <div className="vp-task-section-title">{tr("Primary Tasks")}</div>
                <TableSection className="todo-table-wrapper">
                <TableScroll>
                  <table className="vp-table">
                    <thead>
                      <tr>
                        <th>{tr("Category")}</th>
                        <th>{tr("Task Title")}</th>
                        <th>{tr("Date Created")}</th>
                        <th>{tr("Estimated Duration")}</th>
                        <th>{tr("Status")}</th>
                        {showTaskActionsColumn && <th>{tr("Actions")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {primaryTasksView.length === 0 ? (
                        <tr><td colSpan={showTaskActionsColumn ? "6" : "5"} className="vp-empty">{tr("No Primary Tasks for this range.")}</td></tr>
                      ) : (
                        primaryTasksPage.map((t, i) => (
                          <tr key={t._id || i}>
                            <td>{t.type || t.module || "—"}</td>
                            <td>{t.title || t.work || t.task || "—"}</td>
                            <td>{(t.dateCreated || t.createdAt) ? String(t.dateCreated || t.createdAt).split("T")[0] : "—"}</td>
                            <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                            <td>
                              <span className={`status ${t.active !== false ? "pending" : "archived"}`} title={tr("Daily completion status is tracked per occurrence — see Task History")}>
                                {t.active !== false ? tr("Active") : tr("Deactivated")}
                              </span>
                            </td>
                            {showTaskActionsColumn && (
                              <td>
                                {isOwner && (
                                  <div className="vp-row-actions-group">
                                    <button
                                      className="vp-row-edit"
                                      title={tr("Edit task")}
                                      onClick={() => navigate(`/personnel-visitors/personnel/${id}/tasks/edit/${t._id}`)}
                                    >
                                      <FiEdit2 />
                                    </button>
                                    <button
                                      className="vp-row-edit"
                                      title={t.active !== false ? tr("Deactivate — stop producing new daily occurrences") : tr("Reactivate")}
                                      onClick={() => toggleAssignedTaskActive(t)}
                                    >
                                      {t.active !== false ? <FiToggleRight /> : <FiToggleLeft />}
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableScroll>
                <TablePagination
                  currentPage={primaryPager.page}
                  totalPages={primaryPager.totalPages}
                  pageSize={primaryPager.rowsPerPage}
                  totalRecords={primaryPager.totalItems}
                  startIndex={primaryPager.startIndex}
                  endIndex={primaryPager.endIndex}
                  onPageChange={primaryPager.setPage}
                  onPageSizeChange={primaryPager.setRowsPerPage}
                  itemLabel={tr("tasks")}
                />
                </TableSection>
              </div>
            )}

            {!isTargetOwner && (
              <div className="vp-task-group">
                <div className="vp-task-section-title">{tr("Secondary Tasks")}</div>
                <TableSection className="todo-table-wrapper">
                <TableScroll>
                  <table className="vp-table">
                    <thead>
                      <tr>
                        <th>{tr("Category")}</th>
                        <th>{tr("Task Title")}</th>
                        <th>{tr("Date Created")}</th>
                        <th>{tr("Due Date")}</th>
                        <th>{tr("Estimated Duration")}</th>
                        <th>{tr("Status")}</th>
                        {showTaskActionsColumn && <th>{tr("Actions")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {secondaryTasksView.length === 0 ? (
                        <tr><td colSpan={showTaskActionsColumn ? "7" : "6"} className="vp-empty">{tr("No Secondary Tasks for this range.")}</td></tr>
                      ) : (
                        secondaryTasksPage.map((t, i) => (
                          <tr key={t._id || i}>
                            <td>{t.type || t.module || "—"}</td>
                            <td>{t.title || t.work || t.task || "—"}</td>
                            <td>{(t.dateCreated || t.createdAt) ? String(t.dateCreated || t.createdAt).split("T")[0] : "—"}</td>
                            <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                            <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                            <td>
                              <span className={`status ${t.active !== false ? "pending" : "archived"}`} title={tr("Daily completion status is tracked per occurrence — see Task History")}>
                                {t.active !== false ? tr("Active") : tr("Deactivated")}
                              </span>
                            </td>
                            {showTaskActionsColumn && (
                              <td>
                                {isOwner && (
                                  <div className="vp-row-actions-group">
                                    <button
                                      className="vp-row-edit"
                                      title={tr("Edit task")}
                                      onClick={() => navigate(`/personnel-visitors/personnel/${id}/tasks/edit/${t._id}`)}
                                    >
                                      <FiEdit2 />
                                    </button>
                                    <button
                                      className="vp-row-edit"
                                      title={t.active !== false ? tr("Deactivate — stop producing new daily occurrences") : tr("Reactivate")}
                                      onClick={() => toggleAssignedTaskActive(t)}
                                    >
                                      {t.active !== false ? <FiToggleRight /> : <FiToggleLeft />}
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableScroll>
                <TablePagination
                  currentPage={secondaryPager.page}
                  totalPages={secondaryPager.totalPages}
                  pageSize={secondaryPager.rowsPerPage}
                  totalRecords={secondaryPager.totalItems}
                  startIndex={secondaryPager.startIndex}
                  endIndex={secondaryPager.endIndex}
                  onPageChange={secondaryPager.setPage}
                  onPageSizeChange={secondaryPager.setRowsPerPage}
                  itemLabel={tr("tasks")}
                />
                </TableSection>
              </div>
            )}

            <div className="vp-task-group">
              <div className="vp-task-section-title">{tr("Personal Tasks")}</div>
              <TableSection className="todo-table-wrapper">
              <TableScroll>
                <table className="vp-table">
                  <thead>
                    <tr>
                      <th>{tr("Category")}</th>
                      <th>{tr("Task Title")}</th>
                      <th>{tr("Date Created")}</th>
                      <th>{tr("Due Date")}</th>
                      <th>{tr("Estimated Duration")}</th>
                      <th>{tr("Status")}</th>
                      {isSelfRecord && <th>{tr("Actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {personalTasksView.length === 0 ? (
                      <tr><td colSpan={isSelfRecord ? "7" : "6"} className="vp-empty">{tr("No personal tasks for this range.")}</td></tr>
                    ) : (
                      personalTasksPage.map((t, i) => (
                        <tr key={t._id || i}>
                          <td>{t.type || t.module || "—"}</td>
                          <td>{t.title || "—"}</td>
                          <td>{(t.dateCreated || t.createdAt) ? String(t.dateCreated || t.createdAt).split("T")[0] : "—"}</td>
                          <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                          <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                          <td>{statusBadge(t.status || "—")}</td>
                          {isSelfRecord && (
                            <td>
                              {t.status !== "Completed" && (
                                <button className="vp-row-edit" title={tr("Manage in My Tasks")} onClick={() => navigate("/todo")}>
                                  <FiEdit2 />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableScroll>
              <TablePagination
                currentPage={personalPager.page}
                totalPages={personalPager.totalPages}
                pageSize={personalPager.rowsPerPage}
                totalRecords={personalPager.totalItems}
                startIndex={personalPager.startIndex}
                endIndex={personalPager.endIndex}
                onPageChange={personalPager.setPage}
                onPageSizeChange={personalPager.setRowsPerPage}
                itemLabel={tr("tasks")}
              />
              </TableSection>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="vp-table-wrapper">
            {/* Filters live in the Filter button above the table (see
                vp-table-actions) -- not inside this table area. */}
            {historyError && <p style={{ color: "#d94f4f", fontSize: 13, margin: "0 0 10px" }}>{historyError}</p>}

            <table className="vp-table">
              <thead>
                <tr>
                  <th>{tr("Date Completed")}</th>
                  <th>{tr("Farmer Name")}</th>
                  <th>{tr("Task Category")}</th>
                  <th>{tr("Task Name")}</th>
                  <th>{tr("Completion Details")}</th>
                  <th>{tr("Submission Time")}</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan="6" className="vp-empty">{tr("Loading task history…")}</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan="6" className="vp-empty">{tr("No task history for the selected filters.")}</td></tr>
                ) : (
                  history.map((h) => {
                    // Photo proof and remarks always come from the SAME
                    // occurrence record `h` -- both were written together
                    // in the one atomic completion update on the backend
                    // (see submitTaskOccurrence), so there is no risk of
                    // pairing a photo with another submission's remarks.
                    const isExpanded = expandedRemarks.has(h._id);
                    const remarks = h.remarks || "";
                    const isLong = remarks.length > REMARKS_PREVIEW_LENGTH;
                    const remarksPreview = isLong && !isExpanded
                      ? `${remarks.slice(0, REMARKS_PREVIEW_LENGTH)}…`
                      : remarks;
                    return (
                      <tr key={h._id}>
                        <td>{formatPHDateCompleted(h.submittedAt)}</td>
                        <td>{h.farmerName || getName(record)}</td>
                        <td>{tr(h.category)}</td>
                        <td title={h.taskDescription || undefined}>{h.taskName}</td>
                        <td className="vp-completion-cell">
                          <div className="vp-completion-photo">
                            {h.photoProofUrl ? (
                              <button
                                type="button"
                                className="vp-completion-thumb-btn"
                                onClick={() => setPhotoViewer({
                                  url: `${API_BASE}${h.photoProofUrl}`,
                                  taskName: h.taskName,
                                  occurrenceDate: formatPHDateCompleted(h.submittedAt),
                                })}
                                title={tr("View Photo")}
                              >
                                <img
                                  src={`${API_BASE}${h.photoProofUrl}`}
                                  alt={tr("Photo proof thumbnail")}
                                  className="vp-completion-thumb"
                                  loading="lazy"
                                />
                                <span className="vp-completion-thumb-label"><FiImage /> {tr("View Photo")}</span>
                              </button>
                            ) : (
                              <span className="vp-completion-no-photo">{tr("No photo")}</span>
                            )}
                          </div>
                          <div className="vp-completion-remarks">
                            {remarks ? (
                              <>
                                <p className="vp-completion-remarks-text" title={isLong ? remarks : undefined}>
                                  {remarksPreview}
                                </p>
                                {isLong && (
                                  <button
                                    type="button"
                                    className="vp-completion-toggle"
                                    onClick={() => toggleRemarksExpanded(h._id)}
                                  >
                                    {isExpanded ? tr("View Less") : tr("View More")}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="vp-completion-no-remarks">{tr("No remarks")}</span>
                            )}
                          </div>
                        </td>
                        <td>{formatPHSubmissionTime(h.submittedAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="vp-table-footer">
              <span>{tr("Showing")}{" "}{history.length}{" "}{tr("entries")}</span>
            </div>
          </div>
        )}

        {photoViewer && (
          <div className="poc-overlay" onClick={() => setPhotoViewer(null)}>
            <div className="poc-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)" }}>
              <div className="poc-head">
                <h3>{photoViewer.taskName} — {photoViewer.occurrenceDate}</h3>
                <button className="poc-close" onClick={() => setPhotoViewer(null)} aria-label={tr("Close")}><FiX /></button>
              </div>
              <div className="poc-body">
                <img src={photoViewer.url} alt={tr("Photo proof")} className="poc-preview-img" style={{ maxHeight: "60vh" }} />
              </div>
            </div>
          </div>
        )}

        {taskModalOpen && (
          <div className="todo-overlay" onClick={() => setTaskModalOpen(false)}>
            <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
              <div className="todo-modal-head">
                <h3>{isSelfRecord ? "Add Task" : `Assign Task to ${name}`}</h3>
                <button className="todo-modal-close" onClick={() => setTaskModalOpen(false)}>✕</button>
              </div>
              <div className="todo-modal-body">
                {!isSelfRecord && (
                  <div className="todo-field">
                    <label>{tr("Assigned To")}</label>
                    <input value={name} disabled />
                  </div>
                )}
                <div className="todo-field"><label>{tr("Task Title")}</label><input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder={tr("e.g. Review egg production")} /></div>

                {/* Date Created is backend-generated and immutable -- shown
                    here so the Owner isn't left guessing. Previews today's
                    Philippine date; the real timestamp is set by the
                    server at the moment the task is actually created. */}
                <div className="todo-field">
                  <label>{tr("Date Created")}</label>
                  <span className="todo-archived-tag" title={tr("Automatically recorded when the task is created — never editable.")}>
                    {phTodayDisplay()}
                  </span>
                </div>

                <div className="todo-field"><label>{tr("Category")}</label><select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>{myAccessibleCategories.map((c) => <option key={c}>{c}</option>)}</select></div>
                {isSelfRecord ? (
                  <div className="todo-field"><label>{tr("Due Date")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label><input type="date" value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} /></div>
                ) : (
                  <div className="todo-field">
                    <label>{tr("Task Type")}</label>
                    <select value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}>
                      <option value="Primary">{tr("Primary — recurring daily responsibility")}</option>
                      <option value="Secondary">{tr("Secondary — one-off special assignment")}</option>
                    </select>
                  </div>
                )}

                {/* Estimated Duration -- how long the task is expected to
                    take. Optional, applies to every category including
                    Primary, and never auto-completes or expires a task. */}
                <div className="todo-field">
                  <label>{tr("Estimated Duration")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      style={{ flex: 1 }}
                      value={taskForm.estimatedDurationValue}
                      onChange={(e) => setTaskForm({ ...taskForm, estimatedDurationValue: e.target.value })}
                      placeholder={tr("e.g. 30")}
                    />
                    <select
                      style={{ flex: 1 }}
                      value={taskForm.estimatedDurationUnit}
                      onChange={(e) => setTaskForm({ ...taskForm, estimatedDurationUnit: e.target.value })}
                    >
                      <option value="minutes">{tr("Minutes")}</option>
                      <option value="hours">{tr("Hours")}</option>
                    </select>
                  </div>
                </div>

                {/* Due Date -- an optional deadline, distinct from
                    Estimated Duration. Never applicable to Primary tasks;
                    optional for Secondary. */}
                {!isSelfRecord && taskForm.category === "Secondary" && (
                  <div className="todo-field">
                    <label>{tr("Due Date")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label>
                    <input type="date" value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} />
                  </div>
                )}
                {!isSelfRecord && taskForm.category === "Primary" && (
                  <p className="pw-hint" style={{ margin: "-6px 0 0" }}>
                    {tr("Primary tasks are recurring daily responsibilities — no Due Date applies.")}
                  </p>
                )}

                {!isSelfRecord && (
                  <div className="todo-field">
                    <label>{tr("Current Pending Tasks")}{" "}<span className="pw-hint">{tr("(workload visibility only — does not block saving)")}</span></label>
                    {(pendingPersonalForModal.length === 0 && pendingAssignedForModal.length === 0) ? (
                      <div className="pw-empty">{tr("No pending tasks — this person's workload is currently clear.")}</div>
                    ) : (
                      <div className="pw-widget">
                        {pendingPersonalForModal.length > 0 && (
                          <div className="pw-section">
                            <div className="pw-section-title">{tr("Pending Personal Tasks")}</div>
                            <table className="pw-table pw-table-personal">
                              <thead><tr><th>{tr("Category")}</th><th>{tr("Task Title")}</th><th>{tr("Due Date")}</th><th>{tr("Status")}</th></tr></thead>
                              <tbody>
                                {pendingPersonalForModal.map((t) => (
                                  <tr key={t._id}>
                                    <td title={t.type}>{t.type ? tr(t.type) : "—"}</td>
                                    <td title={t.title}>{t.title}</td>
                                    <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                    <td>{tr(t.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {pendingAssignedForModal.length > 0 && (
                          <div className="pw-section">
                            <div className="pw-section-title">{tr("Pending Assigned Tasks")}</div>
                            <table className="pw-table pw-table-assigned">
                              <thead><tr><th>{tr("Assigned By")}</th><th>{tr("Category")}</th><th>{tr("Task Title")}</th><th>{tr("Estimated Duration")}</th><th>{tr("Due Date")}</th><th>{tr("Status")}</th></tr></thead>
                              <tbody>
                                {pendingAssignedForModal.map((t) => (
                                  <tr key={t._id}>
                                    <td title={t.assignedBy}>{t.assignedBy || "—"}</td>
                                    <td title={t.type}>{t.type ? tr(t.type) : "—"}</td>
                                    <td title={t.title}>{t.title}</td>
                                    <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                                    <td>{t.category === "Primary" ? "—" : (t.dueDate ? String(t.dueDate).split("T")[0] : "—")}</td>
                                    <td>{tr(t.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {taskFormError && <div style={{ color: "#c0392b", fontSize: 12.5 }}>{taskFormError}</div>}
              </div>
              <div className="todo-modal-foot">
                <button className="todo-btn-cancel" onClick={() => setTaskModalOpen(false)}>{tr("Cancel")}</button>
                <button className="todo-btn-save" onClick={saveTaskModal} disabled={savingTask || !taskForm.title.trim()}>
                  {savingTask ? "Saving…" : isSelfRecord ? "Add Task" : "Assign Task"}
                </button>
              </div>
            </div>
          </div>
        )}

    </PageLayout>
  );
}