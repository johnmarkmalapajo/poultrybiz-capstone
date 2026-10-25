const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendServerError } = require("../utils/dbStatus");
const { validateSession } = require("../utils/authSession");

const TOKEN_ERRORS = ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"];

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // The token must belong to a session that is still open (not logged
    // out, not idle too long) -- see utils/authSession.js.
    const sessionCheck = await validateSession(decoded);

    if (!sessionCheck.session) {
      return res.status(401).json({
        success: false,
        code: sessionCheck.code,
        message: sessionCheck.message,
      });
    }

    const user = await User.findById(decoded.id).select("name role status archived");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "This account no longer exists.",
      });
    }

    if (user.archived) {
      return res.status(401).json({
        success: false,
        message: "This account has been archived and is no longer part of the farm.",
      });
    }

    if (user.status === "Inactive") {
      return res.status(401).json({
        success: false,
        message: "This account has been deactivated.",
      });
    }

    req.user = {
      id: user._id,
      name: user.name,
      role: user.role,
      status: user.status,
    };

    req.authSession = { jti: decoded.jti };

    next();
  } catch (err) {
    if (TOKEN_ERRORS.includes(err.name)) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REQUIRED",
        message: "Your session has expired. Please log in again.",
      });
    }

    return sendServerError(res, err, "Auth check error", "Couldn't verify your session. Please try again.");
  }
};

const ownerOnly = (req, res, next) => {
  if (req.user.role !== "Owner") {
    return res.status(403).json({
      success: false,
      message: "Owner access only.",
    });
  }

  next();
};

const recordEditor = (req, res, next) => {
  if (
    req.user.role !== "Owner" &&
    req.user.role !== "Farmer"
  ) {
    return res.status(403).json({
      success: false,
      message: "Only Owners and Farmers can perform this action.",
    });
  }

  next();
};

const farmerOnly = (req, res, next) => {
  if (req.user.role !== "Farmer") {
    return res.status(403).json({
      success: false,
      message: "Farmer access only.",
    });
  }

  next();
};

module.exports = {
  protect,
  ownerOnly,
  recordEditor,
  farmerOnly,
};