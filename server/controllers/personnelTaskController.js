const Personnel = require("../models/Personnel");
const PersonnelTask = require("../models/PersonnelTask");
const TaskOccurrence = require("../models/TaskOccurrence");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");
const { createArchiveEntry } = require("./archiveController");
const { canUseCategory } = require("../utils/moduleRegistry");
const { phToday } = require("../utils/dateGuard");

function canManageTaskFor(requesterRole, targetRole, isSelf, { allowSelfBypass = true } = {}) {
  if (isSelf && allowSelfBypass) return true;
  if (requesterRole === "Owner") return true;
  return false;
}

const taskError = (status, message) => Object.assign(new Error(message), { status });

// Estimated Duration: how long the task is expected to take. Optional and
// applies to EVERY category, including Primary. Distinct from Due Date (a
// deadline) -- never auto-completes or expires a task. Returns null when
// omitted/empty, or { value, unit } when provided; throws a 400 taskError
// on an invalid shape or a non-positive value.
function parseEstimatedDuration(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw taskError(400, "Estimated Duration must include a value and a unit.");
  }
  const { value, unit } = raw;
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw taskError(400, "Estimated Duration must be a positive number.");
  }
  const u = ["minutes", "hours"].includes(unit) ? unit : "minutes";
  return { value: n, unit: u };
}

// Due Date: an optional calendar deadline. Never applicable to Primary
// tasks (perpetually recurring); optional for Secondary. Returns null when
// omitted/empty, or a Date when provided; throws a 400 taskError on an
// unparseable value.
function parseOptionalDueDate(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw taskError(400, "Due Date must be a valid date.");
  }
  return d;
}

// Lazily creates (or returns the existing) occurrence for a task on a given
// PH day. Primary tasks are keyed by (task, today) so a brand-new Pending
// occurrence appears every calendar day without any cron job. Secondary
// tasks are one-off assignments, not daily-recurring ones, so they only
// ever get ONE lifetime occurrence: once one exists for the task (whatever
// its date), it is reused and never regenerated, even across days.
//
// The unique (task, occurrenceDate) index on TaskOccurrence is the
// authoritative duplicate guard: upsert here can race under concurrent
// requests, and whichever loses the race simply gets the winner's document
// back via the findOne fallback instead of throwing.
async function getOrCreateOccurrence(task) {
  if (task.category === "Primary") {
    const today = phToday();
    return upsertOccurrence(task, today);
  }

  // Secondary: reuse the single existing occurrence if there is one.
  const existing = await TaskOccurrence.findOne({ task: task._id }).sort({ occurrenceDate: 1 });
  if (existing) return existing;
  return upsertOccurrence(task, phToday());
}

async function upsertOccurrence(task, occurrenceDate) {
  try {
    return await TaskOccurrence.findOneAndUpdate(
      { task: task._id, occurrenceDate },
      {
        $setOnInsert: {
          task: task._id,
          personnel: task.personnel,
          category: task.category,
          occurrenceDate,
          status: "Pending",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      // Lost the upsert race to a concurrent request; the row now exists.
      const winner = await TaskOccurrence.findOne({ task: task._id, occurrenceDate });
      if (winner) return winner;
    }
    throw err;
  }
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
    category: task.category || "Secondary",
    active: task.active !== false,
    assignedDate: task.assignedDate,
    dueDate: task.dueDate,
    estimatedDuration: (task.estimatedDuration && task.estimatedDuration.value != null)
      ? { value: task.estimatedDuration.value, unit: task.estimatedDuration.unit || "minutes" }
      : null,
    status: task.status,
    remarks: task.remarks,
    assignedBy: task.assignedBy?.name || "Unknown",

    linkedPersonalTodo: task.linkedPersonalTodo,

    personnel: task.personnel,
    createdAt: task.createdAt,
    // Alias for the UI's "Date Created" columns -- always the
    // backend-generated creation timestamp, never editable.
    dateCreated: task.createdAt,
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

    const taskCategory = req.body.category || "Secondary";
    if (!["Primary", "Secondary"].includes(taskCategory)) {
      return res.status(400).json({
        success: false,
        message: "Task category must be Primary or Secondary.",
      });
    }

    // Estimated Duration applies to every category, including Primary.
    const estimatedDuration = parseEstimatedDuration(req.body.estimatedDuration);

    // Due Date is never applicable to Primary tasks (perpetually
    // recurring); optional for Secondary.
    const dueDate = taskCategory === "Secondary"
      ? parseOptionalDueDate(req.body.dueDate)
      : null;

    const task = await PersonnelTask.create({
  personnel: personnel._id,
  assignedBy: req.user.id,

  module: category,
  work: req.body.title || req.body.work,
  category: taskCategory,
  active: true,
  estimatedDuration,

  description: req.body.description || "",
  assignedDate: req.body.assignedDate || new Date(),
  dueDate,
  status,
  remarks: req.body.remarks || "",
});

await createAuditLog({
  req,
  module: "ToDo",
  action: "Added",
  description: `Created ${taskCategory} task "${task.work}" (Module: ${category || "—"}) for personnel.`,
});

if (personnel.user?._id) {
  await createNotification({
    title: taskCategory === "Primary" ? "New Primary Task" : "New Secondary Task",
    description: `${req.user.name} assigned you a new ${taskCategory.toLowerCase()} task: "${task.work}".`,
    category: "task",
    type: "alert",
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
    if (!error.status) console.error("Create Personnel Task Error:", error);

    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to create task.",
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

    // Date Created is backend-generated and must never be overwritten by an
    // edit, however it arrives in the request body; "_id" is likewise never
    // something a PATCH-style body should be allowed to touch.
    delete updateData.createdAt;
    delete updateData._id;

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

    if (updateData.category !== undefined && !["Primary", "Secondary"].includes(updateData.category)) {
      return res.status(400).json({
        success: false,
        message: "Task category must be Primary or Secondary.",
      });
    }

    if (updateData.active !== undefined) {
      updateData.active = updateData.active === true || updateData.active === "true";
    }

    // Estimated Duration applies to every category, including Primary --
    // validate it whenever it's sent.
    if (updateData.estimatedDuration !== undefined) {
      updateData.estimatedDuration = parseEstimatedDuration(updateData.estimatedDuration);
    }

    // Due Date is never applicable to Primary tasks. Force it back to null
    // if the task is (or is being changed to) Primary -- a due date left
    // over from before a category change would otherwise linger
    // meaninglessly on a perpetually-recurring task. Optional for
    // Secondary; validate it when sent.
    const effectiveCategory = updateData.category !== undefined ? updateData.category : existing.category;
    if (effectiveCategory === "Primary") {
      updateData.dueDate = null;
    } else if (updateData.dueDate !== undefined) {
      updateData.dueDate = parseOptionalDueDate(updateData.dueDate);
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
    if (!error.status) console.error("Update Personnel Task Error:", error);

    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to update task.",
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

// Farmer-facing: the authenticated Farmer's own Primary + Secondary tasks,
// each merged with today's (or, for a one-off Secondary task, its single
// lifetime) occurrence. Generates missing occurrences lazily -- no cron
// job is required for the daily reset.
exports.getMyTasksToday = async (req, res) => {
  try {
    const personnel = await Personnel.findOne({ user: req.user.id });

    if (!personnel) {
      return res.json({ success: true, primary: [], secondary: [] });
    }

    const tasks = await PersonnelTask.find({
      personnel: personnel._id,
      archived: false,
      active: { $ne: false },
    }).sort({ createdAt: -1 });

    const result = [];
    for (const task of tasks) {
      const occurrence = await getOrCreateOccurrence(task);
      result.push({
        _id: task._id,
        title: task.work,
        description: task.description,
        type: task.module,
        category: task.category || "Secondary",
        dueDate: task.dueDate,
        estimatedDuration: (task.estimatedDuration && task.estimatedDuration.value != null)
          ? { value: task.estimatedDuration.value, unit: task.estimatedDuration.unit || "minutes" }
          : null,
        dateCreated: task.createdAt,
        occurrence: {
          _id: occurrence._id,
          occurrenceDate: occurrence.occurrenceDate,
          status: occurrence.status,
          photoProofUrl: occurrence.photoProofUrl,
          remarks: occurrence.remarks,
          submittedAt: occurrence.submittedAt,
        },
      });
    }

    res.json({
      success: true,
      primary: result.filter((t) => t.category === "Primary"),
      secondary: result.filter((t) => t.category === "Secondary"),
    });
  } catch (error) {
    console.error("Get My Tasks Today Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch today's tasks.",
    });
  }
};

// Required Proof of Completion submission. Enforced server-side (not just
// hidden in the UI): a Farmer can only submit for an occurrence tied to
// their own Personnel record, photo + remarks are both mandatory, and the
// occurrence is only ever marked Completed after the photo is actually
// saved to disk and the full update commits -- a failed upload or a lost
// race against a duplicate submission never leaves the task falsely
// marked done.
exports.submitTaskOccurrence = async (req, res) => {
  try {
    const occurrence = await TaskOccurrence.findById(req.params.occurrenceId).populate({
      path: "personnel",
      populate: { path: "user" },
    });

    if (!occurrence) {
      throw taskError(404, "Task occurrence not found.");
    }

    const ownerUserId = occurrence.personnel?.user?._id;
    if (!ownerUserId || String(ownerUserId) !== String(req.user.id)) {
      throw taskError(403, "You can only submit Proof of Completion for your own tasks.");
    }

    if (occurrence.status === "Completed") {
      throw taskError(409, "Proof of Completion has already been submitted for this occurrence.");
    }

    const remarks = (req.body.remarks || "").trim();
    if (!remarks) {
      throw taskError(400, "Remarks are required and cannot be empty or whitespace-only.");
    }
    if (remarks.length > 500) {
      throw taskError(400, "Remarks cannot exceed 500 characters.");
    }

    if (!req.file) {
      throw taskError(400, "A Photo Proof of Completion is required.");
    }

    const photoProofUrl = `/uploads/tasks/${req.file.filename}`;

    // Fetched before the completion write so the task's title/description
    // can be snapshotted onto the occurrence exactly as they read "at the
    // time of completion" -- Task History must keep showing this wording
    // even if the Owner later edits or removes the task definition itself.
    const task = await PersonnelTask.findById(occurrence.task);

    // Atomic, condition-guarded update: only succeeds if this occurrence
    // was still Pending at the moment of the write, so two near-simultaneous
    // submissions for the same occurrence can never both "succeed".
    const updated = await TaskOccurrence.findOneAndUpdate(
      { _id: occurrence._id, status: "Pending" },
      {
        $set: {
          status: "Completed",
          photoProofUrl,
          remarks,
          submittedAt: new Date(),
          submittedBy: req.user.id,
          taskTitle: task?.work || "",
          taskDescription: task?.description || "",
        },
      },
      { new: true }
    );

    if (!updated) {
      throw taskError(409, "Proof of Completion has already been submitted for this occurrence.");
    }

    await createAuditLog({
      req,
      module: "ToDo",
      action: "Edited",
      description: `Submitted Proof of Completion for ${occurrence.category} task "${task?.work || ""}" (${occurrence.occurrenceDate}).`,
    });

    if (task?.assignedBy && String(task.assignedBy) !== String(req.user.id)) {
      await createNotification({
        title: `${occurrence.category} Task Completed`,
        description: `${req.user.name} submitted Proof of Completion for "${task?.work || "a task"}".`,
        category: "task",
        type: "alert",
        userId: task.assignedBy,
        referenceId: task._id,
        referenceModel: "PersonnelTask",
      });
    }

    return res.json({
      success: true,
      message: "Proof of Completion submitted successfully.",
      occurrence: updated,
    });
  } catch (error) {
    if (!error.status) console.error("Submit Task Occurrence Error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to submit Proof of Completion. Please try again.",
    });
  }
};

// Owner-side Personnel task history: every historical occurrence for one
// Farmer, optionally filtered by date range and Primary/Secondary category.
// A Farmer may view only their own history; an Owner may view anyone's.
// Occurrences are never overwritten day-to-day, so this always reflects the
// complete, permanent submission record even after "today's" occurrence
// has moved on.
exports.getTaskOccurrenceHistory = async (req, res) => {
  try {
    const personnel = await Personnel.findById(req.params.id).populate("user");

    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel not found.",
      });
    }

    const isSelf = String(personnel.user?._id) === String(req.user.id);
    if (!isSelf && req.user.role !== "Owner") {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this task history.",
      });
    }

    // Task History is completed submissions only -- a Pending occurrence
    // is today's still-open task, not a submission, and belongs in the
    // Tasks section instead. This is intentionally not a query option.
    const filter = { personnel: personnel._id, status: "Completed" };

    if (req.query.category && ["Primary", "Secondary"].includes(req.query.category)) {
      filter.category = req.query.category;
    }

    // "Date Completed" filtering is done against `submittedAt` -- the real
    // completion instant -- not `occurrenceDate`. For a Primary task the
    // two usually agree (the daily occurrence is completed the same day
    // it's generated), but for a Secondary task `occurrenceDate` is set
    // once, the first time the Farmer ever loads it, and can predate the
    // actual completion by days; `submittedAt` is the only field that is
    // always the true completion moment for both categories. `from`/`to`
    // are Philippine calendar days (YYYY-MM-DD) from the date picker, so
    // they're converted to the matching UTC instant range (PH is UTC+8)
    // rather than compared as strings against a UTC timestamp.
    const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
    const phDayStartUTC = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - PH_OFFSET_MS);

    if (req.query.from || req.query.to) {
      filter.submittedAt = {};
      if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) {
        filter.submittedAt.$gte = phDayStartUTC(req.query.from);
      }
      if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) {
        // Exclusive end: the start of the PH day right after `to`.
        filter.submittedAt.$lt = new Date(phDayStartUTC(req.query.to).getTime() + 24 * 60 * 60 * 1000);
      }
      if (Object.keys(filter.submittedAt).length === 0) delete filter.submittedAt;
    }

    const occurrences = await TaskOccurrence.find(filter)
      .populate({ path: "task", select: "work description module" })
      .populate({ path: "submittedBy", select: "name" })
      .sort({ submittedAt: -1 })
      .limit(500);

    // This endpoint is always scoped to one Personnel record (`:id`), so
    // every row's Farmer Name is the same -- the Farmer whose record this
    // is -- but the column is still populated per-row rather than relying
    // on the frontend's own copy of the record, in case this is ever read
    // outside the per-Farmer page.
    const farmerName = personnel.user?.name || "";

    const records = occurrences.map((o) => ({
      _id: o._id,
      taskId: o.task?._id || null,
      // Prefer the snapshot taken at the moment of completion (preserves
      // the task exactly as it read then, even if since edited or
      // deleted); fall back to a live join for occurrences recorded
      // before this snapshot existed.
      taskName: o.taskTitle || o.task?.work || "(Task definition no longer available)",
      taskDescription: o.taskDescription || o.task?.description || "",
      category: o.category,
      occurrenceDate: o.occurrenceDate,
      farmerName,
      status: o.status,
      remarks: o.remarks,
      photoProofUrl: o.photoProofUrl,
      submittedAt: o.submittedAt,
      submittedBy: o.submittedBy?.name || "",
    }));

    res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("Get Task Occurrence History Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch task history.",
    });
  }
};