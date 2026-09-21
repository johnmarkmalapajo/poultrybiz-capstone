import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiEdit2, FiUser, FiPhone, FiClock, FiCalendar, FiMapPin,
  FiFilter, FiChevronDown, FiPlus,
} from "react-icons/fi";
import {
  MdOutlineFactCheck, MdOutlineAssignmentTurnedIn, MdOutlineCancel, MdOutlineAccessTime,
} from "react-icons/md";
import { getFarmInfo } from "../api/profile";
import PageLayout from "../components/PageLayout";
import "./ViewPersonnel.css";
import "./ToDo.css";
import { getPersonnel, getPersonnelAttendance, getPersonnelTasks } from "../api/personnelManpower";
import { listPersonalTodos } from "../api/todo";
import { assignTask, addPersonalTodo } from "../todoStore";
import { getAccessibleCategories } from "../moduleRegistry";
import { useUser } from "../hooks/useUser";

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
  const [taskForm, setTaskForm] = useState({ title: "", type: "", priority: "Medium", due: "" });
  const [savingTask, setSavingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        else setError("Personnel record not found.");
      })
      .catch((err) => setError(err?.message || "Couldn't load this personnel record."))
      .finally(() => setLoading(false));

    getPersonnelAttendance(id)
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && (d.records || d.data)) || [];
        setAttendance(list);
      })
      .catch(() => setAttendance([]));

    refreshAssignedTasksForRecord();
  }, [id]);

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

  const tasks = useMemo(
    () => [...assignedTasks, ...personalTasksForRecord],
    [assignedTasks, personalTasksForRecord]
  );

  const statusBadge = (status) => (
    <span className={`badge ${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
  );

  const priorityBadge = (priority) =>
    priority ? (
      <span className={`badge prio-${String(priority).toLowerCase()}`}>{priority}</span>
    ) : (
      "—"
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

  const rangedAttendance = attendance.filter((a) => inRange(a.date));
  const present = rangedAttendance.filter((a) => a.status === "Present").length;
  const absent = rangedAttendance.filter((a) => a.status === "Absent").length;
  const late = rangedAttendance.filter((a) => a.status === "Late").length;
  const tasksCompleted = tasks .filter((t) => inRange(t.assignedDate || t.createdAt || t.dueDate)) .filter((t) => t.status === "Completed") .length;

  const name = getName(record);
  const canEditRecord = isOwner;

  const ASSIGN_TASK_HIDDEN_CATEGORIES = ["Sales Record", "Expense Record", "Personnel", "Visitor's Log", "User & Roles", "Archive", "Audit Logs"];
  const myAccessibleCategories = getAccessibleCategories({ isOwner, canSeeFinancials, canViewPersonnel })
    .filter((c) => !ASSIGN_TASK_HIDDEN_CATEGORIES.includes(c));
  const openTaskModal = () => {
    setTaskFormError("");
    setTaskForm({ title: "", type: myAccessibleCategories[0] || "", priority: "Medium", due: "" });
    setTaskModalOpen(true);
  };
  const saveTaskModal = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    setTaskFormError("");
    try {
      if (isSelfRecord) {
        await addPersonalTodo(currentUser?.id, {
          title: taskForm.title.trim(), type: taskForm.type, priority: taskForm.priority, dueDate: taskForm.due,
        });
        refreshPersonalTasksForRecord();
      } else {
        await assignTask(id, {
          title: taskForm.title.trim(), type: taskForm.type, priority: taskForm.priority, dueDate: taskForm.due,
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
          <p className="pb-loading-text">Loading personnel record...</p>
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
                  <p><FiUser /> Position / Role</p>
                  <h4>{getPosition(record)}</h4>
                </div>
                <div>
                  <p><FiPhone /> Contact Number</p>
                  <h4>{getContact(record)}</h4>
                </div>
                {!isTargetOwner && (
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
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="vp-header-actions">
            {canEditRecord && (
              <button className="vp-edit-btn" onClick={() => navigate(`/personnel-visitors/personnel/edit/${id}`)}>
                <FiEdit2 /> Edit Profile
              </button>
            )}
          </div>
        </div>

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

        <div className="vp-table-top">
          <div className="vp-tabs">
            <button className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>
              Attendance
            </button>
            {canManageTasks && (
              <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>
                Tasks
              </button>
            )}
          </div>
          <div className="vp-table-actions">
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

            {activeTab === "tasks" && (isSelfRecord || canAddTask) && (
              <button
                className="vp-add-btn"
                onClick={openTaskModal}
              >
                <FiPlus /> {isSelfRecord ? "Add Task" : "Assign Task"}
              </button>
            )}
          </div>
        </div>

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
          ) : (
            <div className="vp-task-sections">
              <div className="vp-task-section">
                <div className="vp-task-section-title">Personal Tasks</div>
                <table className="vp-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Task Title</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      {isSelfRecord && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {personalTasksView.length === 0 ? (
                      <tr><td colSpan={isSelfRecord ? "6" : "5"} className="vp-empty">No personal tasks for this range.</td></tr>
                    ) : (
                      personalTasksView.map((t, i) => (
                        <tr key={t._id || i}>
                          <td>{t.type || t.module || "—"}</td>
                          <td>{t.title || "—"}</td>
                          <td>{priorityBadge(t.priority)}</td>
                          <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                          <td>{statusBadge(t.status || "—")}</td>
                          {isSelfRecord && (
                            <td>
                              {t.status !== "Completed" && (
                                <button className="vp-row-edit" title="Manage in My Tasks" onClick={() => navigate("/todo")}>
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
              </div>

              <div className="vp-task-section">
                <div className="vp-task-section-title">Assigned Tasks</div>
                <table className="vp-table">
                  <thead>
                    <tr>
                      <th>Assigned By</th>
                      <th>Category</th>
                      <th>Task Title</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      {showTaskActionsColumn && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {assignedTasksView.length === 0 ? (
                      <tr><td colSpan={showTaskActionsColumn ? "7" : "6"} className="vp-empty">No assigned tasks for this range.</td></tr>
                    ) : (
                      assignedTasksView.map((t, i) => (
                        <tr key={t._id || i}>
                          <td>{t.assignedBy || "—"}</td>
                          <td>{t.type || t.module || "—"}</td>
                          <td>{t.title || t.work || t.task || "—"}</td>
                          <td>{priorityBadge(t.priority)}</td>
                          <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                          <td>{statusBadge(t.status || "—")}</td>
                          {showTaskActionsColumn && (
                            <td>
                              {isOwner && (
                                <button
                                  className="vp-row-edit"
                                  title="Edit task"
                                  onClick={() => navigate(`/personnel-visitors/personnel/${id}/tasks/edit/${t._id}`)}
                                >
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
              </div>
            </div>
          )}

          <div className="vp-table-footer">
            <span>Showing {activeTab === "attendance" ? attendanceView.length : tasksView.length} entries</span>
          </div>
        </div>

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
                    <label>Assigned To</label>
                    <input value={name} disabled />
                  </div>
                )}
                <div className="todo-field"><label>Task Title</label><input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Review egg production" /></div>
                <div className="todo-field"><label>Category</label><select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>{myAccessibleCategories.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div className="todo-field"><label>Priority</label><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
                <div className="todo-field"><label>Due Date</label><input type="date" value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} /></div>

                {!isSelfRecord && (
                  <div className="todo-field">
                    <label>Current Pending Tasks <span className="pw-hint">(workload visibility only — does not block saving)</span></label>
                    {(pendingPersonalForModal.length === 0 && pendingAssignedForModal.length === 0) ? (
                      <div className="pw-empty">No pending tasks — this person's workload is currently clear.</div>
                    ) : (
                      <div className="pw-widget">
                        {pendingPersonalForModal.length > 0 && (
                          <div className="pw-section">
                            <div className="pw-section-title">Pending Personal Tasks</div>
                            <table className="pw-table pw-table-personal">
                              <thead><tr><th>Category</th><th>Task Title</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
                              <tbody>
                                {pendingPersonalForModal.map((t) => (
                                  <tr key={t._id}>
                                    <td title={t.type}>{t.type || "—"}</td>
                                    <td title={t.title}>{t.title}</td>
                                    <td>{t.priority}</td>
                                    <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                    <td>{t.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {pendingAssignedForModal.length > 0 && (
                          <div className="pw-section">
                            <div className="pw-section-title">Pending Assigned Tasks</div>
                            <table className="pw-table pw-table-assigned">
                              <thead><tr><th>Assigned By</th><th>Category</th><th>Task Title</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
                              <tbody>
                                {pendingAssignedForModal.map((t) => (
                                  <tr key={t._id}>
                                    <td title={t.assignedBy}>{t.assignedBy || "—"}</td>
                                    <td title={t.type}>{t.type || "—"}</td>
                                    <td title={t.title}>{t.title}</td>
                                    <td>{t.priority}</td>
                                    <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                    <td>{t.status}</td>
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
                <button className="todo-btn-cancel" onClick={() => setTaskModalOpen(false)}>Cancel</button>
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