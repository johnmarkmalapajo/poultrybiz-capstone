const PersonalTodo = require("../models/PersonalTodo");
const Personnel = require("../models/Personnel");
const PersonnelTask = require("../models/PersonnelTask");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");
const { createArchiveEntry } = require("./archiveController");
const Archive = require("../models/Archive");
const { canUseCategory } = require("../utils/moduleRegistry");

exports.getAllPersonalTodos = async (req, res) => {
  try {
    const todos = await PersonalTodo.find({ archived: false })
      .populate("user", "name role")
      .sort({ createdAt: -1 });

    const scoped = todos.filter((t) => {
      const ownerRole = t.user?.role;
      if (ownerRole !== "Farmer") return false;
      if (String(t.user?._id) === String(req.user.id)) return false;
      return true;
    });

    res.json(scoped);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getPersonalTodos = async (req, res) => {
  try {
    const todos = await PersonalTodo.find({
      user: req.query.userId,
      archived: false,
    }).sort({ createdAt: -1 });

    res.json(todos);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.createPersonalTodo = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const category = req.body.type || "Records";
    if (!canUseCategory(category, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to use this Category.",
      });
    }

    const todo = await PersonalTodo.create({
      user: ownerId,
      title: req.body.title,
      description: req.body.description || "",
      type: category,
      priority: req.body.priority || "Medium",
      dueDate: req.body.dueDate,
      status: "Pending",
    });

    const personnel = await Personnel.findOne({
  $or: [
    { user: ownerId },
    { _id: ownerId },
  ],
});

if (personnel) {
  await PersonnelTask.create({
    personnel: personnel._id,
    work: todo.title,
    module: todo.type,
    description: todo.description,
    priority: todo.priority,
    dueDate: todo.dueDate,
    status: "Pending",
    assignedBy: req.user._id,

    linkedPersonalTodo: todo._id,
  });
}

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Personal To-Do",
      action: "Added",
      description: `Added personal to-do "${todo.title}".`,
    });

    if (req.user?.role === "Farmer") {
      await createNotification({
        title: "New Personal Task",
        description: `${req.user.name} created a new personal task: "${todo.title}".`,
        category: "task",
        type: "alert",
        priority: "Normal",
        roles: ["Owner"],
      });
    }

    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.updatePersonalTodo = async (req, res) => {
  try {
    const existing = await PersonalTodo.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        message: "Todo not found.",
      });
    }

    if (String(existing.user) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this personal task.",
      });
    }

    if (req.body.status && !["Pending", "Completed"].includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Personal Tasks may only be Pending or Completed.",
      });
    }

    const todo = await PersonalTodo.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (!todo) {
      return res.status(404).json({
        message: "Todo not found.",
      });
    }

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Personal To-Do",
      action: "Edited",
      description: req.body.status === "Completed"
        ? `Marked personal to-do "${todo.title}" as Completed.`
        : `Updated personal to-do "${todo.title}".`,
    });

    if (req.body.status === "Completed" && req.user?.role === "Farmer") {
      await createNotification({
        title: "Personal Task Completed",
        description: `${req.user.name} completed a personal task: "${todo.title}".`,
        category: "task",
        type: "alert",
        priority: "Normal",
        roles: ["Owner"],
      });
    }

    res.json(todo);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.deletePersonalTodo = async (req, res) => {
  try {
    const existing = await PersonalTodo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        message: "Todo not found.",
      });
    }
    if (String(existing.user) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this personal task.",
      });
    }

    const todo = await PersonalTodo.findByIdAndDelete(req.params.id);

    await PersonnelTask.findOneAndDelete({
      linkedPersonalTodo: todo._id,
    });

    await Archive.findOneAndDelete({
      moduleKey: "pb_personal_todos",
      recordId: todo._id,
    });

    if (!todo) {
      return res.status(404).json({
        message: "Todo not found.",
      });
    }

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Personal To-Do",
      action: "Deleted",
      description: `Deleted personal to-do "${todo.title}".`,
    });

    res.json({
      message: "Todo deleted successfully.",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.archivePersonalTodo = async (req, res) => {
  try {
    const todo = await PersonalTodo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found.",
      });
    }

    if (String(todo.user) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to archive this personal task.",
      });
    }

    todo.archived = true;
    todo.archivedAt = new Date();
    todo.archivedBy = req.user.name;

    await todo.save();

    const PersonnelTask = require("../models/PersonnelTask");

await PersonnelTask.findOneAndUpdate(
  { linkedPersonalTodo: todo._id },
  {
    archived: true,
    archivedAt: todo.archivedAt,
    archivedBy: req.user.name,
  }
);

    await createArchiveEntry({
      module: "Personal Todo",
      moduleKey: "pb_personal_todos",
      recordId: todo._id,
      recordName: todo.title,
      archivedBy: req.user.name,
      payload: todo.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Personal Todo",
      action: "Archived",
      description: `Archived todo "${todo.title}".`,
      prev: todo,
      next: null,
    });

    return res.json({
      success: true,
      message: "Todo archived successfully.",
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Unable to archive todo.",
    });
  }
};

exports.restorePersonalTodo = async (req, res) => {
  try {
    const todo = await PersonalTodo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found.",
      });
    }

    if (String(todo.user) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to restore this personal task.",
      });
    }

    todo.archived = false;
    todo.archivedAt = null;
    todo.archivedBy = null;

    await todo.save();

    await PersonnelTask.findOneAndUpdate(
      { linkedPersonalTodo: todo._id },
      {
        archived: false,
        archivedAt: null,
        archivedBy: null,
      }
    );

    await Archive.findOneAndDelete({
      moduleKey: "pb_personal_todos",
      recordId: todo._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Personal Todo",
      action: "Restored",
      description: `Restored todo "${todo.title}".`,
    });

    return res.json({
      success: true,
      message: "Todo restored successfully.",
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Unable to restore todo.",
    });
  }
};