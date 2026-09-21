const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");
const Personnel = require("../models/Personnel");

exports.checkFirstAccount = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    return res.json({
      success: true,
      isFirstAccount: totalUsers === 0,
    });
  } catch (error) {
    console.error("Check First Account Error:", error);

    return res.json({
      success: false,
      isFirstAccount: false,
    });
  }
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.json({
        success: false,
        message: "Email already registered.",
      });
    }

    const totalUsers = await User.countDocuments();

    const isFirstUser = totalUsers === 0;

    const assignedRole = isFirstUser
      ? "Owner"
      : "Farmer";

    const assignedStatus = isFirstUser
      ? "Active"
      : "Pending";

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: assignedRole,
      status: assignedStatus,
    });

    if (isFirstUser) {
      user.lastLogin = new Date();
      await user.save();
    }

    if (isFirstUser) {
      await Personnel.create({
        user: user._id,
        position: "Owner",
        shiftHours: "",
        status: "Active",
        dateHired: new Date(),
        assignedWork: "",
        remarks: "",
      });
    }

    if (isFirstUser) {
      const token = jwt.sign(
        {
          id: user._id,
          name: user.name,
          role: user.role,
          status: user.status,
        },
        process.env.JWT_SECRET,
        {
         expiresIn: "7d",
        }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
    }

    await createNotification({
      title: "New Account Signup",
      description: `${user.name} (${user.email}) signed up as a Farmer and is waiting for your approval.`,
      category: "users",
      type: "alert",
      priority: "Normal",
      roles: ["Owner"],
      referenceId: user._id,
      referenceModel: "User",
    });

    return res.json({
      success: true,
      isPending: true,
      message:
        "Registration successful! Please wait for Owner approval before logging in.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Signup Error:", error);

    return res.json({
      success: false,
      message: "Signup failed.",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });


    if (!user) {
      return res.json({
        success: false,
        message: "No account found with that email.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Incorrect password.",
      });
    }

    if (user.archived) {
      return res.json({
        success: false,
        isArchived: true,
        message:
          "This account has been archived and is no longer part of the farm.",
      });
    }

    if (user.status === "Pending") {
      return res.json({
        success: false,
        isPending: true,
        message:
          "Your account is still waiting for Owner approval.",
      });
    }

    if (user.status === "Inactive") {
      return res.json({
        success: false,
        isRejected: true,
        message:
          "Your account has been rejected or deactivated.",
      });
    }
      user.lastLogin = new Date();
      await user.save();

      await createAuditLog({
        user: user.name,
        role: user.role,
        module: "Authentication",
        action: "Login",
        description: `${user.name} logged into the system.`,
      });

    const token = jwt.sign(
      {
       id: user._id,
       name: user.name,
       role: user.role,
       status: user.status,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const personnel = await Personnel.findOne({ user: user._id });

    console.log("USER ID:", user._id.toString());
    console.log("PERSONNEL:", personnel);

    console.log({
  success: true,
  token,
  user: {
    id: user._id,
    personnelId: personnel?._id || null,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  },
});


    return res.json({
      success: true,
      token,
      user: {
  id: user._id,
  personnelId: personnel?._id || null,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  avatar: user.avatar || "",
},
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.json({
      success: false,
      message: "Login failed.",
    });
  }
};

exports.forgotPassword = async (req, res) => {

  try {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: false,
        message: "No account found with that email.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60;

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const resetLink =
      `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"PoultryBiz" <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: "Reset Your Password — PoultryBiz",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #eee;">
          <h2 style="color:#3b2008;">Reset Your Password</h2>
          <p>Hi <strong>${user.name}</strong>,</p>

          <p>
            Click the button below to reset your password.
            This link expires in <strong>1 hour</strong>.
          </p>

          <a
            href="${resetLink}"
            style="display:inline-block;margin:24px 0;padding:14px 32px;background:#e8a020;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;"
          >
            Reset Password
          </a>

          <p style="color:#888;font-size:12px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: "Reset link sent to your email.",
    });

  } catch (error) {

    console.error("Forgot Password Error:", error);

    return res.json({
      success: false,
      message: "Something went wrong.",
    });

  }
};

exports.resetPassword = async (req, res) => {
  try {

    const { token, password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful.",
    });

  } catch (error) {

    console.error("Reset Password Error:", error);

    return res.json({
      success: false,
      message: "Something went wrong.",
    });

  }
};

exports.logout = async (req, res) => {
  try {
    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Authentication",
      action: "Logout",
      description: `${req.user.name} logged out of the system.`,
    });

    return res.json({
      success: true,
      message: "Logged out successfully.",
    });

  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed.",
    });
  }
};