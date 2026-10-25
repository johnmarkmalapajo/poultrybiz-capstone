const mongoose = require("mongoose");
const { getLastDbError } = require("../config/db");

const DB_UNAVAILABLE_MESSAGE =
  "The server can't reach the database right now. Please try again in a moment.";

const DB_CONNECTION_ERRORS = [
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoTopologyClosedError",
  "MongoNotConnectedError",
];

const READY_STATES = ["disconnected", "connected", "connecting", "disconnecting"];
const REJECTION_LOG_INTERVAL_MS = 30000;

let lastRejectionLogAt = 0;
let rejectedSinceLastLog = 0;

const isDbConnectionError = (err) =>
  DB_CONNECTION_ERRORS.includes(err?.name) ||
  /buffering timed out/i.test(err?.message || "");

// Explains in the terminal why requests are getting 503, at most once every
// 30 seconds so a page full of requests does not flood the log. Only the
// error type and hint are logged -- never the connection string.
const logDatabaseRejection = (req, state) => {
  rejectedSinceLastLog += 1;

  const now = Date.now();
  if (now - lastRejectionLogAt < REJECTION_LOG_INTERVAL_MS) return;

  const lastError = getLastDbError();
  const reason = lastError
    ? `last error: ${lastError.name}${lastError.code ? ` ${lastError.code}` : ""}. ${lastError.hint}`
    : "no connection error recorded yet.";

  console.warn(
    `503 for ${req.method} ${req.originalUrl}: MongoDB is ${READY_STATES[state] || state} (${rejectedSinceLastLog} request(s) rejected in the last ${REJECTION_LOG_INTERVAL_MS / 1000}s) - ${reason}`
  );

  lastRejectionLogAt = now;
  rejectedSinceLastLog = 0;
};

const requireDatabase = (req, res, next) => {
  const state = mongoose.connection.readyState;

  if (state === 1 || state === 2) {
    return next();
  }

  logDatabaseRejection(req, state);

  return res.status(503).json({
    success: false,
    message: DB_UNAVAILABLE_MESSAGE,
  });
};

const sendServerError = (res, err, context, message) => {
  console.error(`${context}:`, err);

  if (isDbConnectionError(err)) {
    return res.status(503).json({
      success: false,
      message: DB_UNAVAILABLE_MESSAGE,
    });
  }

  return res.status(500).json({
    success: false,
    message,
  });
};

module.exports = {
  DB_UNAVAILABLE_MESSAGE,
  isDbConnectionError,
  requireDatabase,
  sendServerError,
};