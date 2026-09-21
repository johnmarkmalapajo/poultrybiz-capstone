const User = require("../models/User");
const Personnel = require("../models/Personnel");
const { createAuditLog } = require("./auditController");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

async function resolvePersonnelInfo(user) {
  if (user.role === "Owner") {
    return { position: "Owner", employmentStatus: "Active" };
  }
  const personnel = await Personnel.findOne({ user: user._id }).select("position status");
  return {
    position: personnel?.position || "",
    employmentStatus: personnel?.status || "",
  };
}

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { position, employmentStatus } = await resolvePersonnelInfo(user);

    return res.json({
      success: true,
      record: {
        fullName: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        avatar: user.avatar || "",
        role: user.role,
        position,
        employmentStatus,
        status: user.status,
        dateJoined: user.createdAt
            ? user.createdAt.toISOString().split("T")[0]
            : "",
        lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })
        : "Never",
        language: user.language || "English",
        timezone: user.timezone || "(GMT+08:00) Asia/Manila",
        emailNotif: user.emailNotif ?? true,
        loginAlerts: user.loginAlerts ?? true,
        farmName: user.farmName || "",
        farmLocation: user.farmLocation || "",
        farmContact: user.farmContact || "",
        farmEmail: user.farmEmail || "",
        farmLogo: user.farmLogo || "",
      },
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to load profile.",
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {

    const {
      fullName,
      email,
      phone,
      address,
      avatar,
      language,
      timezone,
      emailNotif,
      loginAlerts,
      farmName,
      farmLocation,
      farmContact,
      farmEmail,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.name = fullName;
    user.email = email;
    user.phone = phone;
    user.address = address;
    user.avatar = avatar;
    user.language = language;
    user.timezone = timezone;
    user.emailNotif = emailNotif;
    user.loginAlerts = loginAlerts;

    if (farmName !== undefined) user.farmName = farmName;
    if (farmLocation !== undefined) user.farmLocation = farmLocation;
    if (farmContact !== undefined) user.farmContact = farmContact;
    if (farmEmail !== undefined) user.farmEmail = farmEmail;

    await user.save();

    const { position, employmentStatus } = await resolvePersonnelInfo(user);

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated profile information.",
    });

    return res.json({
      success: true,
      record: {
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        role: user.role,
        position,
        employmentStatus,
        status: user.status,
        dateJoined: user.createdAt,
        lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })
        : "Never",
        language: user.language,
        timezone: user.timezone,
        emailNotif: user.emailNotif,
        loginAlerts: user.loginAlerts,
        farmName: user.farmName || "",
        farmLocation: user.farmLocation || "",
        farmContact: user.farmContact || "",
        farmEmail: user.farmEmail || "",
        farmLogo: user.farmLogo || "",
      },
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Profile update failed.",
    });

  }
};

exports.getFarmInfo = async (req, res) => {
  try {
    const owner = await User.findOne({ role: "Owner" });

    return res.json({
      farmName: owner?.farmName || "",
      farmLocation: owner?.farmLocation || "",
      farmContact: owner?.farmContact || "",
      farmEmail: owner?.farmEmail || "",
      farmLogo: owner?.farmLogo || "",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to load farm information.",
    });
  }
};

exports.uploadFarmLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded.",
      });
    }

    if (user.farmLogo) {
      const oldFile = path.join(
        __dirname,
        "..",
        user.farmLogo.replace(/^\/+/, "")
      );

      if (fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile);
      }
    }

    user.farmLogo = `/uploads/farm/${req.file.filename}`;

    await user.save();

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated farm logo.",
    });

    res.json({
      success: true,
      message: "Farm logo updated successfully.",
      farmLogo: user.farmLogo,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to upload farm logo.",
    });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded.",
      });
    }

    if (user.avatar) {
      const oldFile = path.join(
        __dirname,
        "..",
        user.avatar.replace(/^\/+/, "")
      );

      if (fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile);
      }
    }

    user.avatar = `/uploads/profile/${req.file.filename}`;

    await user.save();

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated profile picture.",
    });

    res.json({
      success: true,
      message: "Profile picture updated successfully.",
      avatar: user.avatar,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to upload profile picture.",
    });
  }
};

exports.changePassword = async (req, res) => {

  try {

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    const match = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Changed account password.",
    });

    res.json({
      success: true,
      message: "Password updated successfully.",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update password.",
    });

  }
};