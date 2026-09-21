const Visitor = require("../models/Visitor");
const VisitorLog = require("../models/VisitorLog");
const Biosecurity = require("../models/Biosecurity");
const Archive = require("../models/Archive");
const { createNotification } = require("./notificationController");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");

exports.registerVisitor = async (req, res) => {
  try {
    const { visitor, log, biosecurity } = req.body;

    let visitorRecord = await Visitor.findOne({
      fullName: visitor.fullName,
      contactNumber: visitor.contactNumber,
    });

    if (!visitorRecord) {
      visitorRecord = await Visitor.create({
        fullName: visitor.fullName,
        address: visitor.address,
        affiliation: visitor.affiliation,
        contactNumber: visitor.contactNumber,
        visitCount: 1,
        lastVisitDate: log.dateOfVisit,
      });
    } else {
      visitorRecord.address = visitor.address;
      visitorRecord.affiliation = visitor.affiliation;
      visitorRecord.contactNumber = visitor.contactNumber;
      visitorRecord.visitCount += 1;
      visitorRecord.lastVisitDate = log.dateOfVisit;

      await visitorRecord.save();
    }

    const visitorLog = await VisitorLog.create({
      visitor: visitorRecord._id,
      dateOfVisit: log.dateOfVisit,
      purpose: log.purpose,
      vehiclePlate: log.vehiclePlate,
    });

const riskLevel =
  biosecurity.otherFarm7d === "Yes" ||
  biosecurity.poultry48h === "Yes" ||
  biosecurity.fluSymptoms === "Yes"
    ? "High"
    : "Low";

const biosecurityRecord = await Biosecurity.create({
  visitorLog: visitorLog._id,

  footbath: biosecurity.footbath,
  ppe: biosecurity.ppe,
  disinfection: biosecurity.disinfection,
  otherFarm7d: biosecurity.otherFarm7d,
  otherFarmName: biosecurity.otherFarmName,
  poultry48h: biosecurity.poultry48h,
  cleanClothes: biosecurity.cleanClothes,
  entryDisinfection: biosecurity.entryDisinfection,
  fluSymptoms: biosecurity.fluSymptoms,

  riskLevel,
});

await createNotification({
    title: "New Visitor Checked In",
    description: `${visitorRecord.fullName} (${visitorRecord.affiliation}) checked in at ${new Date().toLocaleTimeString()} on ${new Date(log.dateOfVisit).toLocaleDateString()}. Purpose: ${log.purpose || "—"}.`,
    category: "visitor",
    type: "alert",
    priority: "Warning",
    roles: ["Owner"],
    referenceId: visitorRecord._id,
    referenceModel: "Visitor",
});

if (riskLevel === "High") {
  await createNotification({
    title: "Biosecurity Risk — Visitor Flagged",
    description: `${visitorRecord.fullName} answered 'Yes' to a biosecurity risk question during check-in on ${new Date(log.dateOfVisit).toLocaleDateString()}. Review before allowing farm access.`,
    category: "visitor",
    type: "alert",
    priority: "Critical",
    roles: ["Owner"],
    referenceId: visitorRecord._id,
    referenceModel: "Visitor",
});
}

    await createAuditLog({
      user: req.user?.name || "System",
      role: req.user?.role || "System",
      module: "Visitors",
      action: "Added",
      description: `Visitor "${visitorRecord.fullName}" checked in (purpose: ${log.purpose || "—"}, risk: ${riskLevel}).`,
    });

    return res.status(201).json({
  success: true,
  message: "Visitor registered successfully.",
  visitor: visitorRecord,
  visitorLog,
  biosecurity: biosecurityRecord,
});

  } catch (error) {
    console.error("Register Visitor Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to register visitor.",
    });
  }
};

exports.getVisitors = async (req, res) => {
  try {
    const visitors = await Visitor.find({ archived: { $ne: true } }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      records: visitors,
    });

  } catch (error) {
    console.error("Get Visitors Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load visitors.",
    });
  }
};

exports.archiveVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found.",
      });
    }

    visitor.archived = true;
    visitor.archivedAt = new Date();
    visitor.archivedBy = req.user?.name || "";

    await visitor.save();

    await createArchiveEntry({
      module: "Visitors",
      moduleKey: "pb_visitors",
      recordId: visitor._id,
      recordName: visitor.fullName,
      archivedBy: req.user?.name,
      payload: visitor.toObject(),
    });

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Visitors",
      action: "Archived",
      description: `Archived visitor "${visitor.fullName}".`,
    });

    res.json({
      success: true,
      message: "Visitor archived successfully.",
    });
  } catch (error) {
    console.error("Archive Visitor Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to archive visitor.",
    });
  }
};

exports.restoreVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found.",
      });
    }

    visitor.archived = false;
    visitor.archivedAt = null;
    visitor.archivedBy = null;

    await visitor.save();

    await Archive.findOneAndDelete({
      moduleKey: "pb_visitors",
      recordId: visitor._id,
    });

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Visitors",
      action: "Restored",
      description: `Restored visitor "${visitor.fullName}".`,
    });

    res.json({
      success: true,
      message: "Visitor restored successfully.",
    });
  } catch (error) {
    console.error("Restore Visitor Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to restore visitor.",
    });
  }
};

exports.deleteVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findByIdAndDelete(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_visitors",
      recordId: visitor._id,
    });

    await createAuditLog({
      user: req.user?.name,
      role: req.user?.role,
      module: "Visitors",
      action: "Deleted",
      description: `Permanently deleted visitor "${visitor.fullName}".`,
    });

    res.json({
      success: true,
      message: "Visitor deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Visitor Error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete visitor.",
    });
  }
};

exports.getVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found.",
      });
    }

    res.json({
      success: true,
      record: visitor,
    });

  } catch (error) {
    console.error("Get Visitor Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load visitor.",
    });
  }
};

exports.getVisitorLogs = async (req, res) => {
  try {
    const logs = await VisitorLog.find({
      visitor: req.params.id,
    }).sort({
      dateOfVisit: -1,
    });

    const records = [];

    for (const log of logs) {
      const biosecurity = await Biosecurity.findOne({
        visitorLog: log._id,
      });

      records.push({
        _id: log._id,

        date: log.dateOfVisit
          ? new Date(log.dateOfVisit).toISOString().split("T")[0]
          : "—",

        purpose: log.purpose,

        vehiclePlate: log.vehiclePlate,

        biosecurity,
      });
    }

    res.json({
      success: true,
      records,
    });

  } catch (error) {
    console.error("Get Visitor Logs Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load visitor logs.",
    });
  }
};