const mongoose = require("mongoose");
const User = require("../models/User");
const Personnel = require("../models/Personnel");
const { createAuditLog } = require("./auditController");
const Archive = require("../models/Archive");
const AuditLog = require("../models/AuditLog");
const { assertNoDependencies } = require("./dependencyController");

exports.getAllUsers = async (req, res) => {
  try {
    const filter = { archived: { $ne: true } };

    const users = await User.find(filter)
      .select("-password -resetToken -resetTokenExpiry")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users.",
    });
  }
};

exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({
      status: "Pending",
    })
      .select("-password -resetToken -resetTokenExpiry")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Pending Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending users.",
    });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.status = "Active";
    await user.save();

    const existingPersonnel = await Personnel.findOne({
      user: user._id,
    });

    if (!existingPersonnel) {
      await Personnel.create({
        user: user._id,
        position: "",
        shiftHours: "",
        status: "Active",
        dateHired: new Date(),
        assignedWork: "",
        remarks: "",
      });
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Users",
      action: "Approved",
      description: `Approved user '${user.name}'.`,
    });

    return res.json({
      success: true,
      message: "User approved successfully.",
      user,
    });
  } catch (error) {
    console.error("Approve User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve user.",
    });
  }
};

exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.status = "Inactive";

    await user.save();

    await createAuditLog({
    user: req.user.name,
    role: req.user.role,
    module: "Users",
    action: "Rejected",
    description: `Rejected user '${user.name}'.`,
    });

    return res.json({
      success: true,
      message: "User rejected successfully.",
      user,
    });
  } catch (error) {
    console.error("Reject User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject user.",
    });
  }
};

exports.activateUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responseUser;
    await session.withTransaction(async () => {
      const user = await User.findById(req.params.id).session(session);

      if (!user) {
        throw Object.assign(new Error("User not found."), { status: 404 });
      }

      user.status = "Active";
      await user.save({ session });

      await Personnel.findOneAndUpdate(
        { user: user._id },
        { status: "Active" },
        { session }
      );

      user.password = undefined;
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      responseUser = user;

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Users",
        action: "Edited",
        description: `Activated user '${user.name}' — Personnel status synced to Active.`,
      });
    });

    return res.json({
      success: true,
      message: "User activated successfully.",
      user: responseUser,
    });
  } catch (error) {
    console.error("Activate User Error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to activate user.",
    });
  } finally {
    session.endSession();
  }
};

exports.deactivateUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responseUser;
    await session.withTransaction(async () => {
      const user = await User.findById(req.params.id).session(session);

      if (!user) {
        throw Object.assign(new Error("User not found."), { status: 404 });
      }

      user.status = "Inactive";
      await user.save({ session });

      await Personnel.findOneAndUpdate(
        { user: user._id },
        { status: "Inactive" },
        { session }
      );

      user.password = undefined;
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      responseUser = user;

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Users",
        action: "Edited",
        description: `Deactivated user '${user.name}' — Personnel status synced to Inactive.`,
      });
    });

    return res.json({
      success: true,
      message: "User deactivated successfully.",
      user: responseUser,
    });
  } catch (error) {
    console.error("Deactivate User Error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to deactivate user.",
    });
  } finally {
    session.endSession();
  }
};

exports.archiveUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let archivedName;
    await session.withTransaction(async () => {
      const user = await User.findById(req.params.id).session(session);

      if (!user) {
        throw Object.assign(new Error("User not found."), { status: 404 });
      }

      if (user._id.toString() === req.user.id) {
        throw Object.assign(new Error("You cannot archive your own account."), { status: 400 });
      }

      if (user.role === "Owner") {
        throw Object.assign(new Error("Owner cannot be archived."), { status: 403 });
      }

      user.archived = true;
      user.archivedAt = new Date();
      user.archivedBy = req.user.name;
      await user.save({ session });

      const personnel = await Personnel.findOneAndUpdate(
        { user: user._id },
        { archived: true, archivedAt: new Date() },
        { session, new: true }
      );

      await Archive.create([{
        module: "Users",
        moduleKey: "users",
        recordId: user._id,
        recordName: user.name,
        archivedBy: req.user.name,
        archivedAt: user.archivedAt,
        payload: user.toObject(),
      }], { session });

      if (personnel) {
        await Archive.create([{
          module: "Personnel & Manpower",
          moduleKey: "pb_personnel",
          recordId: personnel._id,
          recordName: user.name,
          archivedBy: req.user.name,
          archivedAt: user.archivedAt,
          payload: personnel.toObject(),
        }], { session });
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Users",
        action: "Archived",
        description: `Archived user "${user.name}" — login disabled and linked Personnel profile archived.`,
      });

      archivedName = user.name;
    });

    res.json({
      success: true,
      message: "User archived successfully.",
    });
  } catch (err) {
    console.error(err);

    res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : "Server Error",
    });
  } finally {
    session.endSession();
  }
};

exports.restoreUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(req.params.id).session(session);

      if (!user) {
        throw Object.assign(new Error("User not found."), { status: 404 });
      }

      const prevStatus = user.status;

      user.archived = false;
      user.archivedAt = null;
      user.archivedBy = null;
      await user.save({ session });

      const personnel = await Personnel.findOneAndUpdate(
        { user: user._id },
        { archived: false, archivedAt: null },
        { session, new: true }
      );

      await Archive.findOneAndDelete({
        moduleKey: "users",
        recordId: user._id,
      }, { session });

      if (personnel) {
        await Archive.findOneAndDelete({
          moduleKey: "pb_personnel",
          recordId: personnel._id,
        }, { session });
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Users",
        action: "Restored",
        description: `Restored user "${user.name}" back to ${prevStatus} — login and Personnel profile reinstated.`,
      });
    });

    res.json({
      success: true,
      message: "User restored successfully.",
    });
  } catch (err) {
    console.error(err);

    res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : "Server Error",
    });
  } finally {
    session.endSession();
  }
};

exports.getArchivedUsers = async (req, res) => {
  try {
    let query = {
      archived: true,
    };

    const users = await User.find(query)
      .sort({ archivedAt: -1 })
      .select("-password");

    res.json({
      success: true,
      users,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.deleteUserPermanently = async (req, res) => {
  try {
    if (req.user.role !== "Owner") {
      return res.status(403).json({
        success: false,
        message: "Only Owner can permanently delete users.",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.archived) {
      return res.status(400).json({
        success: false,
        message: "Only archived users can be permanently deleted.",
      });
    }

    const block = await assertNoDependencies("user", user._id);
    if (block) {
      return res.status(409).json(block);
    }

    await User.findByIdAndDelete(user._id);

    await Archive.findOneAndDelete({
      moduleKey: "users",
      recordId: user._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Users",
      action: "Deleted",
      description: `Permanently deleted user "${user.name}".`,
      prev: {
        name: user.name,
        role: user.role,
        archived: true,
      },
      next: null,
    });

    return res.json({
      success: true,
      message: "User permanently deleted.",
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};