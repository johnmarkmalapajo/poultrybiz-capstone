const Archive = require("../models/Archive");
const { createAuditLog } = require("./auditController");

// Shared by every module's archive action — writes the entry that makes a
// record actually show up on the Archive page. Marking a record
// `archived: true` in its own collection is not enough by itself; without
// this, nothing shows up here except Users (the only module that was
// already calling Archive.create directly).
exports.createArchiveEntry = async ({ module, moduleKey, recordId, recordName, archivedBy, payload }) => {
  try {
    await Archive.create({
      module,
      moduleKey,
      recordId,
      recordName,
      archivedBy,
      payload,
    });
  } catch (err) {
    console.error("Create Archive Entry Error:", err);
  }
};

/* ===========================
   GET ALL ARCHIVED RECORDS
=========================== */
exports.getArchivedRecords = async (req, res) => {
  try {
    const records = await Archive.find({})
      .sort({ archivedAt: -1 });

    return res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("Get Archive Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch archived records.",
    });
  }
};

/* ===========================
   DELETE ARCHIVE ENTRY
=========================== */
exports.deleteArchiveEntry = async (req, res) => {
  try {
    const archive = await Archive.findById(req.params.id);

    if (!archive) {
      return res.status(404).json({
        success: false,
        message: "Archive entry not found.",
      });
    }

    await archive.deleteOne();

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: archive.module || "Archive",
      action: "Deleted",
      description: `Permanently deleted archived ${archive.module || "record"} "${archive.recordName || archive._id}".`,
    });

    return res.json({
      success: true,
      message: "Archive entry deleted.",
    });
  } catch (error) {
    console.error("Delete Archive Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete archive entry.",
    });
  }
};