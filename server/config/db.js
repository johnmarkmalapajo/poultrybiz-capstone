const mongoose = require("mongoose");
const dns = require("node:dns");

const RETRY_DELAY_MS = 10000;
const FALLBACK_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const SYSTEM_DNS_SERVERS = dns.getServers();

let usingFallbackDns = false;
let retryTimer = null;
let listenersAttached = false;
let hasConnected = false;
let failedAttempts = 0;
let lastErrorKey = "";

// Last connection failure, kept for the 503 diagnostics in utils/dbStatus.js.
// Never holds the connection string or credentials.
let lastDbError = null;

const isSrvLookupError = (error) =>
  error?.syscall === "querySrv" || /querySrv/i.test(error?.message || "");

// Remove "user:password@" from anything that may echo the connection string.
const redact = (text) =>
  String(text || "").replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, "$1***@");

// Turns a Mongo/Mongoose connection error into a short, actionable hint.
const diagnoseDbError = (error) => {
  const message = String(error?.message || "");
  const code = String(error?.code || error?.codeName || "");

  if (!process.env.MONGO_URI) {
    return "MONGO_URI is not set in server/.env.";
  }

  if (error?.name === "MongoParseError" || /Invalid scheme|URI malformed|Invalid connection string/i.test(message)) {
    return "MONGO_URI in server/.env is not a valid MongoDB connection string. Copy it again from MongoDB Atlas (Connect > Drivers).";
  }

  if (/bad auth|Authentication failed|auth failed/i.test(message) || code === "8000" || code === "18") {
    return "The database username or password in MONGO_URI was rejected. Check the Database User in MongoDB Atlas and URL-encode special characters in the password.";
  }

  if (isSrvLookupError(error) || /ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return "The cluster address could not be resolved (DNS). Check that this computer is online and the cluster name in MONGO_URI is correct. If your network blocks SRV lookups, use the standard (non-SRV) connection string from MongoDB Atlas.";
  }

  if (/whitelist|IP that isn't|not allowed to access/i.test(message)) {
    return "MongoDB Atlas refused this computer's IP address. Add your current IP in Atlas > Network Access, then wait about a minute.";
  }

  if (error?.name === "MongoServerSelectionError" || /Server selection timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return "No database server answered. Check your internet connection, that this computer's IP is allowed in Atlas > Network Access, and that the Atlas cluster is not paused.";
  }

  return "Unexpected database connection error. See the message above.";
};

const recordFailure = (error) => {
  failedAttempts += 1;

  lastDbError = {
    name: error?.name || "Error",
    code: error?.code || error?.codeName || "",
    message: redact(error?.message).slice(0, 300),
    hint: diagnoseDbError(error),
    at: new Date().toISOString(),
    attempts: failedAttempts,
  };

  const key = `${lastDbError.name}|${lastDbError.code}|${lastDbError.message}`;

  // Full details the first time an error appears (or when it changes);
  // a one-line reminder on later retries so the terminal stays readable.
  if (key !== lastErrorKey) {
    lastErrorKey = key;
    console.error(`MongoDB Error (${lastDbError.name}${lastDbError.code ? ` ${lastDbError.code}` : ""}): ${lastDbError.message}`);
    console.error(`MongoDB Hint: ${lastDbError.hint}`);
  } else {
    console.error(`MongoDB still unreachable (attempt ${failedAttempts}): ${lastDbError.name}${lastDbError.code ? ` ${lastDbError.code}` : ""}.`);
  }

  console.error(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000} seconds. API requests will return 503 until the database is connected.`);
};

const attachConnectionListeners = () => {
  if (listenersAttached) return;

  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    hasConnected = true;
    failedAttempts = 0;
    lastErrorKey = "";
    lastDbError = null;
  });

  mongoose.connection.on("disconnected", () => {
    if (hasConnected) {
      console.warn("MongoDB disconnected. API requests will return 503 until it reconnects.");
    }
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });

  mongoose.connection.on("error", (error) => {
    if (hasConnected) {
      console.error(`MongoDB connection error: ${redact(error?.message)}`);
    }
  });
};

const scheduleRetry = () => {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connectDB, RETRY_DELAY_MS);
};

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    lastDbError = {
      name: "ConfigError",
      code: "",
      message: "MONGO_URI is not set.",
      hint: "Add MONGO_URI to server/.env and restart the server.",
      at: new Date().toISOString(),
      attempts: 0,
    };
    console.error("MongoDB Error: MONGO_URI is not set in server/.env. The API will return 503 until it is configured and the server is restarted.");
    return;
  }

  attachConnectionListeners();

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (isSrvLookupError(error)) {
      usingFallbackDns = !usingFallbackDns;
      dns.setServers(usingFallbackDns ? FALLBACK_DNS_SERVERS : SYSTEM_DNS_SERVERS);

      if (usingFallbackDns) {
        console.warn(`MongoDB DNS lookup failed (${error.code || redact(error.message)}). Retrying with public DNS servers ${FALLBACK_DNS_SERVERS.join(", ")}.`);
        return connectDB();
      }
    }

    recordFailure(error);
    scheduleRetry();
  }
};

const getLastDbError = () => lastDbError;

module.exports = connectDB;
module.exports.getLastDbError = getLastDbError;
module.exports.redactConnectionString = redact;