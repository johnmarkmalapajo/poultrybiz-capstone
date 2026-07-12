// personnelData.js
// Shared frontend mock data (single source of truth) for the Personnel module.
// Place this at: src/data/personnelData.js  (adjust the import paths if different)
//
// Each personnel is keyed by a stable _id. The View Personnel page looks records
// up by that id, so every employee shows ONLY their own profile, attendance,
// and tasks. Editing one record does not affect the others.
//
// Full Name, Contact Number, and Image live under `profile` — these are synced
// from the Farmer's My Profile (read-only). Everything else is Admin-managed.

export const PERSONNEL = [
  {
    _id: "o1", accountRole: "Owner / Admin", status: "Active",
    position: "Owner / Admin", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Engr. Maria Egginear", contactNumber: "0917 000 1111", image: "" },
  },
  {
    _id: "f1", accountRole: "Farmer", position: "Farm Worker",
    dateHired: "2023-01-10", shiftHours: "6:00 AM - 3:00 PM", status: "Active",
    assignedWork: "Morning feeding · Cage 1-4 cleaning", remarks: "Hardworking and trustworthy.",
    profile: { fullName: "Juan Dela Cruz", contactNumber: "0917 123 4567", image: "" },
  },
  {
    _id: "f2", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-02-15", shiftHours: "7:00 AM - 4:00 PM", status: "Active",
    assignedWork: "Vaccination round (Flock B-002)", remarks: "Skilled in poultry care.",
    profile: { fullName: "Maria Santos", contactNumber: "0917 234 5678", image: "" },
  },
  {
    _id: "f3", accountRole: "Farmer", position: "Maintenance Worker",
    dateHired: "2023-03-01", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "Water line + equipment check", remarks: "Handles equipment maintenance.",
    profile: { fullName: "Pedro Reyes", contactNumber: "0917 345 6789", image: "" },
  },
  {
    _id: "f4", accountRole: "Farmer", position: "Inventory Clerk",
    dateHired: "2023-03-20", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "", remarks: "Organized and detail-oriented.",
    profile: { fullName: "Ana Garcia", contactNumber: "0917 456 7890", image: "" },
  },
  {
    _id: "f5", accountRole: "Farmer", position: "Farm Hand",
    dateHired: "2023-04-05", shiftHours: "6:00 AM - 3:00 PM", status: "On Leave",
    assignedWork: "", remarks: "On medical leave until further notice.",
    profile: { fullName: "Mark Villanueva", contactNumber: "0917 567 8901", image: "" },
  },
  {
    _id: "f6", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-06-12", shiftHours: "7:00 AM - 4:00 PM", status: "Inactive",
    assignedWork: "", remarks: "Resigned last May 30, 2024.",
    profile: { fullName: "Grace Lagon", contactNumber: "0917 678 9012", image: "" },
  },
];

// ── Per-personnel attendance (only the selected employee's logs show) ──
export const ATTENDANCE_BY_ID = {
  f1: [
    { _id: "a1", timestamp: "08:00 AM", date: "May 1, 2024", timeIn: "7:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
    { _id: "a2", timestamp: "08:10 AM", date: "May 2, 2024", timeIn: "7:10 AM", timeOut: "5:00 PM", status: "Late",    remarks: "Delayed due to weather", taskCompleted: true },
    { _id: "a3", timestamp: "07:55 AM", date: "May 3, 2024", timeIn: "6:55 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  f2: [
    { _id: "a1", timestamp: "07:50 AM", date: "May 1, 2024", timeIn: "6:50 AM", timeOut: "4:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
    { _id: "a2", timestamp: "--",       date: "May 2, 2024", timeIn: "--",      timeOut: "--",      status: "Absent",  remarks: "Sick Leave" },
    { _id: "a3", timestamp: "07:58 AM", date: "May 3, 2024", timeIn: "6:58 AM", timeOut: "4:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  f3: [
    { _id: "a1", timestamp: "08:05 AM", date: "May 1, 2024", timeIn: "8:05 AM", timeOut: "5:00 PM", status: "Late",    remarks: "Traffic", taskCompleted: true },
    { _id: "a2", timestamp: "08:00 AM", date: "May 2, 2024", timeIn: "8:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  f4: [
    { _id: "a1", timestamp: "08:00 AM", date: "May 1, 2024", timeIn: "8:00 AM", timeOut: "5:00 PM", status: "Present", remarks: "Completed", taskCompleted: true },
  ],
  f5: [],
  f6: [],
};

// ── Per-personnel tasks (assigned by Owner/Admin) ──
// status: "Pending" | "In Progress" | "Completed"   priority: "High" | "Medium" | "Low"
export const TASKS_BY_ID = {
  f1: [
    { _id: "t1", date: "May 1, 2024", work: "Morning feeding (Cage 1-4)", assignedDate: "Apr 30, 2024", dueDate: "May 1, 2024", priority: "High",   status: "Completed" },
    { _id: "t2", date: "May 2, 2024", work: "Egg collection + sorting",   assignedDate: "May 1, 2024",  dueDate: "May 2, 2024", priority: "Medium", status: "In Progress" },
    { _id: "t3", date: "May 3, 2024", work: "Cage cleaning",              assignedDate: "May 2, 2024",  dueDate: "May 4, 2024", priority: "Low",    status: "Pending" },
  ],
  f2: [
    { _id: "t1", date: "May 1, 2024", work: "Vaccination (Flock B-002)",  assignedDate: "Apr 29, 2024", dueDate: "May 1, 2024", priority: "High",   status: "Completed" },
    { _id: "t2", date: "May 3, 2024", work: "Health check round",         assignedDate: "May 2, 2024",  dueDate: "May 3, 2024", priority: "Medium", status: "Pending" },
  ],
  f3: [
    { _id: "t1", date: "May 1, 2024", work: "Water line inspection",      assignedDate: "Apr 30, 2024", dueDate: "May 2, 2024", priority: "Medium", status: "In Progress" },
  ],
  f4: [],
  f5: [],
  f6: [],
};

export const getPersonnelById = (id) => PERSONNEL.find((p) => p._id === id) || null;
export const getAttendanceById = (id) => ATTENDANCE_BY_ID[id] || [];
export const getTasksById = (id) => TASKS_BY_ID[id] || [];
export const getTaskById = (personId, taskId) =>
  (TASKS_BY_ID[personId] || []).find((t) => t._id === taskId) || null;
