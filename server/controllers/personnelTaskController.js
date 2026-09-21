const Personnel = require("../models/Personnel");
const PersonnelTask = require("../models/PersonnelTask");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");
const { createArchiveEntry } = require("./archiveController");
const { canUseCategory } = require("../utils/moduleRegistry");

function canManageTaskFor(requesterRole, targetRole, isSelf, { allowSelfBypass = true } = {}) {
  if (isSelf && allowSelfBypass) return true;
  if (requesterRole === "Owner") return true;
  return false;
}

exports.getPersonnelTasks = async (req, res) => {
  try {
    const tasks = await PersonnelTask.find({
  personnel: req.params.id,
})
.populate({
  path: "assignedBy",
  select: "name",
})
.sort({
  assignedDate: -1,
  createdAt: -1,
});

    res.json({
  success: true,
  records: tasks.map((task) => ({
    _id: task._id,
    title: task.work,
    type: task.module,
    description: task.description,
    assignedDate: task.assignedDate,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
    remarks: task.remarks,
    assignedBy: task.assignedBy?.name || "Unknown",

    linkedPersonalTodo: task.linkedPersonalTodo,
    
    personnel: task.personnel,
    createdAt: task.createdAt,
    archived: task.archived,
    archivedAt: task.archivedAt,
    archivedBy: task.archivedBy,
  })),
});
  } catch (error) {
    console.error("Get Personnel Tasks Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch personnel tasks.",
    });
  }
};

exports.getPersonnelTask = async (req, res) => {
  try {
    const task = await PersonnelTask.findOne({
      _id: req.params.taskId,
      personnel: req.params.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    res.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get Personnel Task Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch task.",
    });
  }
};

exports.createPersonnelTask = async (req, res) => {
  try {

    const personnel = await Personnel.findById(req.params.id).populate("user");

    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel not found.",
      });
    }

    const targetRole = personnel.user?.role || "";
    const isSelf = String(personnel.user?._id) === String(req.user.id);
    if (!canManageTaskFor(req.user.role, targetRole, isSelf, { allowSelfBypass: false })) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to assign a task to this personnel.",
      });
    }

    if (personnel.archived) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a task to an archived personnel record.",
      });
    }
    if (personnel.user?.status && personnel.user.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a task to an inactive user.",
      });
    }

    const category = req.body.type || req.body.module || "";
    if (!canUseCategory(category, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to use this Category.",
      });
    }

    const status = req.body.status || "Pending";
    if (!["Pending", "Completed", "Archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const task = await PersonnelTask.create({
  personnel: personnel._id,
  assignedBy: req.user.id,

  module: category,
  work: req.body.title || req.body.work,

  description: req.body.description || "",
  assignedDate: req.body.assignedDate || new Date(),
  dueDate: req.body.dueDate || null,
  priority: req.body.priority || "Medium",
  status,
  remarks: req.body.remarks || "",
});

await createAuditLog({
  req,
  module: "ToDo",
  action: "Added",
  description: `Assigned task "${task.work}" (Category: ${category || "—"}) to personnel.`,
});

if (personnel.user?._id) {
  await createNotification({
    title: "New Assigned Task",
    description: `${req.user.name} assigned you a new task: "${task.work}".`,
    category: "task",
    type: "alert",
    priority: task.priority === "High" ? "Critical" : "Warning",
    userId: personnel.user._id,
    referenceId: task._id,
    referenceModel: "PersonnelTask",
  });
}

    res.status(201).json({
      success: true,
      message: "Task created successfully.",
      task,
    });
  } catch (error) {
    console.error("Create Personnel Task Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create task.",
    });
  }
};

exports.updatePersonnelTask = async (req, res) => {
  try {
    const existing = await PersonnelTask.findById(req.params.taskId).populate({
      path: "personnel",
      populate: { path: "user" },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const targetRole = existing.personnel?.user?.role || "";
    const isSelf = String(existing.personnel?.user?._id) === String(req.user.id);
    if (!canManageTaskFor(req.user.role, targetRole, isSelf)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to manage this task.",
      });
    }

    const updateData = { ...req.body };

    let reassignedTo = null;
    if (updateData.personnelId && String(updateData.personnelId) !== String(existing.personnel?._id)) {
      const newPersonnel = await Personnel.findById(updateData.personnelId).populate("user");
      if (!newPersonnel) {
        return res.status(404).json({
          success: false,
          message: "Selected personnel not found.",
        });
      }
      const canReassign = req.user.role === "Owner";
      if (!canReassign) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to reassign to this person.",
        });
      }
      updateData.personnel = newPersonnel._id;
      reassignedTo = newPersonnel;
    }
    delete updateData.personnelId;

    if (updateData.status && !["Pending", "Completed", "Archived"].includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const newCategory = updateData.type || updateData.module;
    if (newCategory !== undefined) {
      if (!canUseCategory(newCategory, req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to use this Category.",
        });
      }
      updateData.module = newCategory;
      delete updateData.type;
    }

    if (
      updateData.status === "Completed" &&
      !updateData.completedDate
    ) {
      updateData.completedDate = new Date();
    }

    const task = await PersonnelTask.findByIdAndUpdate(
      req.params.taskId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    await createAuditLog({
      req,
      module: "ToDo",
      action: "Edited",
      description: reassignedTo
        ? `Reassigned task "${task.work}" to ${reassignedTo.user?.name || "another person"}.`
        : updateData.status === "Completed"
        ? `Marked task "${task.work}" as Completed.`
        : `Updated task "${task.work}".`,
    });

    if (reassignedTo?.user?._id) {
      await createNotification({
        title: "Task Reassigned",
        description: `${req.user.name} reassigned a task to you: "${task.work}".`,
        category: "task",
        type: "alert",
        priority: task.priority === "High" ? "Critical" : "Warning",
        userId: reassignedTo.user._id,
        referenceId: task._id,
        referenceModel: "PersonnelTask",
      });
    }

    const isCompleting = updateData.status === "Completed" && existing.status !== "Completed";
    if (
      isCompleting &&
      existing.assignedBy &&
      String(existing.assignedBy) !== String(req.user.id)
    ) {
      await createNotification({
        title: "Assigned Task Completed",
        description: `${req.user.name} marked your assigned task "${task.work}" as completed.`,
        category: "task",
        type: "alert",
        priority: task.priority === "High" ? "Critical" : "Warning",
        userId: existing.assignedBy,
        referenceId: task._id,
        referenceModel: "PersonnelTask",
      });
    }

    if (!isCompleting && !reassignedTo && existing.personnel?.user?._id) {
      const assigneeUserId = existing.personnel.user._id;
      if (String(assigneeUserId) !== String(req.user.id)) {
        await createNotification({
          title: "Assigned Task Updated",
          description: `${req.user.name} updated your assigned task: "${task.work}".`,
          category: "task",
          type: "alert",
          priority: task.priority === "High" ? "Critical" : "Warning",
          userId: assigneeUserId,
          referenceId: task._id,
          referenceModel: "PersonnelTask",
        });
      }
    }

    res.json({
      success: true,
      message: "Task updated successfully.",
      task,
    });
  } catch (error) {
    console.error("Update Personnel Task Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update task.",
    });
  }
};

exports.archivePersonnelTask = async (req, res) => {
  try {
    const task = await PersonnelTask.findById(req.params.taskId).populate({
      path: "personnel",
      populate: { path: "user" },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const targetRole = task.personnel?.user?.role || "";
    const isSelf = String(task.personnel?.user?._id) === String(req.user.id);

    if (!canManageTaskFor(req.user.role, targetRole, isSelf)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to archive this task.",
      });
    }

    task.archived = true;
    task.archivedAt = new Date();
    task.archivedBy = req.user.name;

    await task.save();

    await createArchiveEntry({
      module: "To Do",
      moduleKey: "pb_todo",
      recordId: task._id,
      recordName: task.work,
      archivedBy: req.user.name,
      payload: task.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "To Do",
      action: "Archived",
      description: `Archived task "${task.work}".`,
      prev: task,
      next: null,
    });

    return res.json({
      success: true,
      message: "Task archived successfully.",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to archive task.",
    });
  }
};

exports.restorePersonnelTask = async (req, res) => {
  try {
    const task = await PersonnelTask.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    task.archived = false;
    task.archivedAt = null;
    task.archivedBy = null;

    await task.save();

    await Archive.findOneAndDelete({
      moduleKey: "pb_todo",
      recordId: task._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "To Do",
      action: "Restored",
      description: `Restored task "${task.work}".`,
      prev: null,
      next: task,
    });

    return res.json({
      success: true,
      message: "Task restored successfully.",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to restore task.",
    });
  }
};
exports.deletePersonnelTask = async (req, res) => {
  try {
    const task = await PersonnelTask.findById(req.params.taskId).populate({
      path: "personnel",
      populate: { path: "user" },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const targetRole = task.personnel?.user?.role || "";
    const isSelf = String(task.personnel?.user?._id) === String(req.user.id);
    if (!canManageTaskFor(req.user.role, targetRole, isSelf)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to manage this task.",
      });
    }

    await PersonnelTask.findByIdAndDelete(req.params.taskId);

    await Archive.findOneAndDelete({
      moduleKey: "pb_todo",
      recordId: task._id,
    });

    await createAuditLog({
      req,
      module: "ToDo",
      action: "Deleted",
      description: `Deleted task "${task.work}".`,
    });

    res.json({
      success: true,
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Personnel Task Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete task.",
    });
  }
};