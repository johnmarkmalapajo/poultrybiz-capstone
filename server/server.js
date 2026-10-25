// Run the whole backend on Philippine time. Render servers default to UTC,
// which made "today" roll over at 8:00 AM PH time -- so before 8 AM, today's
// date was rejected as a "future date" by the date checks. Must be set
// before anything else uses Date.
process.env.TZ = "Asia/Manila";

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { requireDatabase } = require("./utils/dbStatus");
const path = require("path");
const fs = require("fs");
const personnelRoutes = require("./routes/personnelRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const archiveRoutes = require("./routes/archiveRoutes");

dotenv.config();
connectDB();

const app = express();

const configuredOrigins = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  ...configuredOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Origin:", origin);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked Origin:", origin);

      const error = new Error(`Origin ${origin} is not allowed by CORS. Add it to CLIENT_URL in server/.env.`);
      error.status = 403;
      error.expose = true;

      return callback(error);
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

app.use(BASE, requireDatabase);

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
// ERROR HANDLER
// ==============================

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(status).json({
    success: false,
    message: err.expose ? err.message : "Something went wrong on the server.",
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