const mongoose = require("mongoose");
const Personnel = require("../models/Personnel");
const User = require("../models/User");
const Archive = require("../models/Archive");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { assertNoDependencies } = require("./dependencyController");
const PersonnelTask = require("../models/PersonnelTask");
const Attendance = require("../models/Attendance");

exports.createPersonnel = async (req, res) => {
  try {
    const existing = await Personnel.findOne({
      user: req.body.user,
    });

    if (existing) {
      return res.status(400).json({
        message: "Personnel record already exists.",
      });
    }

    const record = await Personnel.create(req.body);

    const populated = await Personnel.findById(record._id).populate("user");

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

exports.getAllPersonnel = async (req, res) => {
  try {
    const existingPersonnelUserIds = await Personnel.distinct("user");
    const usersMissingPersonnel = await User.find({
      _id: { $nin: existingPersonnelUserIds },
      status: { $ne: "Archived" },
    });

    if (usersMissingPersonnel.length > 0) {
      await Personnel.insertMany(
        usersMissingPersonnel.map((u) => ({
          user: u._id,
          position: u.role === "Owner" ? "Owner" : "",
          shiftHours: "",
          status: "Active",
          dateHired: u.createdAt || new Date(),
          assignedWork: "",
          remarks: "",
        }))
      );
    }

    const records = await Personnel.find({
      archived: false,
    })
      .populate("user")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getPersonnel = async (req, res) => {
  try {
    const record = await Personnel.findById(req.params.id).populate({
      path: "user",
      select: "name email phone address avatar role status",
    });

    if (!record) {
      return res.status(404).json({
        message: "Personnel record not found.",
      });
    }

    const targetRole = record.user?.role || "";
    const isTargetOwner = targetRole === "Owner";
    const isOwnRecord = String(record.user?._id) === String(req.user.id);
    if (req.user.role !== "Owner" && isTargetOwner && !isOwnRecord) {
      return res.status(403).json({
        message: "You can only view your own record.",
      });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.updatePersonnel = async (req, res) => {
  try {
    const existing = await Personnel.findById(req.params.id).populate("user");

    if (!existing) {
      return res.status(404).json({
        message: "Personnel record not found.",
      });
    }

    const targetRole = existing.user?.role || "";
    const requesterRole = req.user.role;

    if (requesterRole !== "Owner") {
      return res.status(403).json({
        message: "You don't have permission to edit this record.",
      });
    }

    const updates = { ...req.body };
    if (targetRole === "Owner") {
      delete updates.position;
    }

    const record = await Personnel.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).populate("user");

    if (!record) {
      return res.status(404).json({
        message: "Personnel record not found.",
      });
    }
    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Personnel",
      action: "Edited",
      description: `Updated personnel status of '${record.user?.name || record.fullName || "Personnel"}' to '${record.status}'.`,
    });

    res.json(record);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

exports.archivePersonnel = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await Personnel.findById(req.params.id).populate("user").session(session);

      if (!record) {
        throw Object.assign(new Error("Personnel record not found."), { status: 404 });
      }

      const targetRole = record.user?.role || "";

      if (targetRole === "Owner") {
        throw Object.assign(new Error("The Owner's record can't be archived."), { status: 403 });
      }

      if (req.user.role !== "Owner") {
        throw Object.assign(new Error("You don't have permission to archive this record."), { status: 403 });
      }

      record.archived = true;
      record.archivedAt = new Date();
      await record.save({ session });

      if (record.user?._id) {
        await User.findByIdAndUpdate(
          record.user._id,
          {
            archived: true,
            archivedAt: new Date(),
            archivedBy: req.user.name,
          },
          { session }
        );

        await Archive.create([{
          module: "Users",
          moduleKey: "users",
          recordId: record.user._id,
          recordName: record.user?.name,
          archivedBy: req.user.name,
          archivedAt: new Date(),
          payload: record.user.toObject(),
        }], { session });
      }

      await createArchiveEntry({
        module: "Personnel & Manpower",
        moduleKey: "pb_personnel",
        recordId: record._id,
        recordName: record.user?.name || record.position || "Personnel",
        archivedBy: req.user.name,
        payload: record.toObject(),
      });

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Personnel",
        action: "Archived",
        description: `Archived personnel record for '${record.user?.name || "Personnel"}' — their login access was revoked.`,
      });
    });

    res.json({
      message: "Personnel archived successfully.",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      message: err.status ? err.message : err.message,
    });
  } finally {
    session.endSession();
  }
};

exports.restorePersonnel = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await Personnel.findById(req.params.id).populate("user").session(session);

      if (!record) {
        throw Object.assign(new Error("Personnel record not found."), { status: 404 });
      }

      if (req.user.role !== "Owner") {
        throw Object.assign(new Error("Only the Owner can restore personnel records."), { status: 403 });
      }

      record.archived = false;
      record.archivedAt = null;
      await record.save({ session });

      if (record.user?._id) {
        await User.findByIdAndUpdate(
          record.user._id,
          {
            archived: false,
            archivedAt: null,
            archivedBy: null,
          },
          { session }
        );

        await Archive.findOneAndDelete(
          { moduleKey: "users", recordId: record.user._id },
          { session }
        );
      }

      await Archive.findOneAndDelete(
        { moduleKey: "pb_personnel", recordId: record._id },
        { session }
      );

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Personnel",
        action: "Restored",
        description: `Restored personnel record for '${record.user?.name || "Personnel"}' — their login access was reinstated.`,
      });
    });

    res.json({
      message: "Personnel restored successfully.",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      message: err.message,
    });
  } finally {
    session.endSession();
  }
};

exports.deletePersonnel = async (req, res) => {
  try {
    if (req.user.role !== "Owner") {
      return res.status(403).json({
        message: "Only the Owner can permanently delete a personnel record.",
      });
    }

    const block = await assertNoDependencies("personnel", req.params.id);
    if (block) {
      return res.status(409).json(block);
    }

    const record = await Personnel.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Personnel record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_personnel",
      recordId: record._id,
    });

    res.json({
      message: "Personnel deleted successfully.",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getAllAssignedTasks = async (req, res) => {
  try {
    const tasks = await PersonnelTask.find()
      .populate({
        path: "personnel",
        populate: {
          path: "user",
          select: "name role",
        },
      })
      .sort({ createdAt: -1 });

    const visibleTasks =
      req.user.role === "Owner"
        ? tasks
        : tasks.filter((task) => task.personnel?.user?.role !== "Owner");

    const result = visibleTasks.map((task) => ({
      _id: task._id,

      personnelId: task.personnel?._id,
      farmerId: task.personnel?.user?._id,
      farmerName: task.personnel?.user?.name || "Unknown",
      assignedBy: task.assignedBy,

      title: task.work,
      description: task.description,
      type: task.module || "Records",

      assignedDate: task.assignedDate,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      remarks: task.remarks,
      createdAt: task.createdAt,

      archived: task.archived,
      archivedAt: task.archivedAt,
      archivedBy: task.archivedBy,

      linkedPersonalTodo: task.linkedPersonalTodo,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getPersonnelAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({
      personnel: req.params.id,
    }).sort({ date: -1 });

    res.json({
      records: attendance,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};