const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const path = require("path");
const fs = require("fs");
const personnelRoutes = require("./routes/personnelRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const archiveRoutes = require("./routes/archiveRoutes");

dotenv.config();
connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Origin:", origin);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked Origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// Disable HTTP caching on every API response. Express generates a weak
// ETag for every JSON response by default, and browsers will silently
// reuse an old cached body via a 304 "Not Modified" instead of fetching
// fresh data — this app's data changes too often (archives, notifications,
// tasks, etc.) for that to ever be safe.
app.set("etag", false);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ==============================
// UPLOADS
// ==============================

const uploadDir = path.join(__dirname, "uploads");
const profileDir = path.join(uploadDir, "profile");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir);
}

// Serve uploaded images
app.use("/uploads", express.static(uploadDir));

const VERSION = process.env.API_VERSION || "v1";
const BASE = `/api/${VERSION}`;

// ==============================
// ROUTES
// ==============================

// Authentication
app.use(`${BASE}/auth`, require("./routes/auth"));

// Users
app.use(`${BASE}/users`, require("./routes/userRoutes"));

// Profile
app.use(`${BASE}/profile`, require("./routes/profileRoutes"));

// Audit Logs
app.use(`${BASE}/audit-logs`, require("./routes/auditRoutes"));

// Flock Profile
app.use(`${BASE}/flocks`, require("./routes/flockRoutes"));
app.use(`${BASE}/breed`, require("./routes/breedRoutes"));
app.use(`${BASE}/supplier`, require("./routes/supplierRoutes"));

//Egg Record
app.use(`${BASE}/egg-records`, require("./routes/eggRecordRoutes"));

//Mortality Record
app.use(`${BASE}/mortality-records`, require("./routes/mortalityRecordRoutes"));

// Health Record
app.use(`${BASE}/health-records`, require("./routes/healthRecordRoutes"));
app.use(`${BASE}/health-options`, require("./routes/healthOptionRoutes"));
app.use(`${BASE}/veterinarians`, require("./routes/veterinarianRoutes"));

// Quarantine & Isolation Record
app.use(`${BASE}/quarantine-isolation`, require("./routes/quarantineIsolationRoutes"));

// Manure Record
app.use(`${BASE}/manure-records`, require("./routes/manureRecordRoutes"));

// Waste Record
app.use(`${BASE}/waste-records`, require("./routes/wasteRecordRoutes"));

//Feed Inventory 
app.use(`${BASE}/feed-inventory`, require("./routes/feedInventoryRoutes"));

//Feed Consumption
app.use(`${BASE}/feed-consumption`, require("./routes/feedConsumptionRoutes"));

//Equipment
app.use( `${BASE}/equipment`, require("./routes/equipmentRoutes"));

// Personnel
app.use(`${BASE}/personnel`, require("./routes/personnelRoutes"));

// Personal Todos
app.use(`${BASE}/personal-todos`, require("./routes/personalTodoRoutes"));

// Attendance
app.use(`${BASE}/personnel`, require("./routes/attendanceRoutes"));

// Personnel Tasks
app.use(`${BASE}/personnel`, require("./routes/personnelTaskRoutes"));

//Sales Record
app.use(`${BASE}/sales-records`, require("./routes/salesRecordRoutes"));

// Expense Record
app.use(`${BASE}/expense-records`, require("./routes/expenseRecordRoutes"));

//Attendance
app.use(`${BASE}/attendance`, require("./routes/attendanceRoutes"));

//Visitor
app.use(`${BASE}/visitors`, require("./routes/visitorRoutes"));

// Notifications
app.use(`${BASE}/notifications`, require("./routes/notificationRoutes"));

// Archive
app.use(`${BASE}/archive`, require("./routes/archiveRoutes"));

// Dashboard
app.use(`${BASE}/dashboard`, require("./routes/dashboardRoutes"));

// Dependency Validation (Permanent Delete safety check)
app.use(`${BASE}/dependencies`, require("./routes/dependencyRoutes"));

// Report Export Audit Logging
app.use(`${BASE}/reports`, require("./routes/reportRoutes"));

// ==============================
// ROOT
// ==============================

app.get("/", (req, res) => {
  res.json({
    message: "PoultryBiz API is running!",
    version: VERSION,
    baseUrl: BASE,
  });
});

// ==============================
// 404
// ==============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==============================
// SERVER
// ==============================

const PORT = process.env.PORT || 5000;
const { registerNotificationCronJobs } = require("./cron/notificationJobs");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}${BASE}`);
  registerNotificationCronJobs();
});