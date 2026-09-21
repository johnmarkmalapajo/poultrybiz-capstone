import { archiveEggRecord, restoreEggRecord, deleteEggRecord } from "./api/eggRecord";
import { archiveMortalityRecord, restoreMortalityRecord, deleteMortalityRecord } from "./api/mortalityRecord";
import { archiveHealthRecord, restoreHealthRecord, deleteHealthRecord } from "./api/healthRecord";
import { archiveQuarantineRecord, restoreQuarantineRecord, deleteQuarantineRecord } from "./api/quarantineIsolation";
import { archiveWasteRecord, restoreWasteRecord, deleteWasteRecord, archiveManureRecord, restoreManureRecord, deleteManureRecord } from "./api/wasteManure";
import { archiveFeedInventory, restoreFeedInventory, deleteFeedInventory } from "./api/feedInventory";
import { archiveFeedConsumption, restoreFeedConsumption, deleteFeedConsumption } from "./api/feedConsumption";
import { archiveEquipment, restoreEquipment, deleteEquipment } from "./api/equipmentTools";
import { archiveExpenseRecord, restoreExpenseRecord, deleteExpenseRecord } from "./api/expenseRecord";
import { archivePersonnel, restorePersonnel, deletePersonnel } from "./api/personnelManpower";
import { archiveVisitor, restoreVisitor, deleteVisitor } from "./api/visitorLog";
import { archiveFlock, restoreFlock, deleteFlock } from "./api/flockProfile";
import { archiveSalesRecord, restoreSalesRecord, deleteSalesRecord } from "./api/salesRecord";
import { restoreUser } from "./api/users";
import { restoreAssignedTaskById, deleteAssignedTaskById, restorePersonalTodoById, deletePersonalTodoById } from "./todoStore";

const isManure = (record) => /manure/i.test(record?.recordType || record?.type || "");

export const ARCHIVE_FN_BY_MODULE_KEY = {
  pb_eggs: (id) => archiveEggRecord(id),
  pb_mortality: (id) => archiveMortalityRecord(id),
  pb_health: (id) => archiveHealthRecord(id),
  pb_isolation: (id) => archiveQuarantineRecord(id),
  pb_waste: (id, record) => (isManure(record) ? archiveManureRecord(id) : archiveWasteRecord(id)),
  pb_feed_inventory: (id) => archiveFeedInventory(id),
  pb_feed_consumption: (id) => archiveFeedConsumption(id),
  pb_equipment: (id) => archiveEquipment(id),
  pb_expenses: (id) => archiveExpenseRecord(id),
  pb_personnel: (id) => archivePersonnel(id),
  pb_visitors: (id) => archiveVisitor(id),
  pb_batches: (id) => archiveFlock(id),
  pb_sales: (id) => archiveSalesRecord(id),
};

export const RESTORE_FN_BY_MODULE_KEY = {
  users: (id) => restoreUser(id),
  pb_eggs: (id) => restoreEggRecord(id),
  pb_mortality: (id) => restoreMortalityRecord(id),
  pb_health: (id) => restoreHealthRecord(id),
  pb_isolation: (id) => restoreQuarantineRecord(id),
  pb_waste: (id, record) => (isManure(record) ? restoreManureRecord(id) : restoreWasteRecord(id)),
  pb_feed_inventory: (id) => restoreFeedInventory(id),
  pb_feed_consumption: (id) => restoreFeedConsumption(id),
  pb_equipment: (id) => restoreEquipment(id),
  pb_expenses: (id) => restoreExpenseRecord(id),
  pb_personnel: (id) => restorePersonnel(id),
  pb_visitors: (id) => restoreVisitor(id),
  pb_batches: (id) => restoreFlock(id),
  pb_sales: (id) => restoreSalesRecord(id),
  pb_todo: (id, record) => restoreAssignedTaskById(record.personnel._id, id),
  pb_personal_todos: (id, record) => restorePersonalTodoById(id, record.user),
};

export const DELETE_FN_BY_MODULE_KEY = {
  pb_eggs: (id) => deleteEggRecord(id),
  pb_mortality: (id) => deleteMortalityRecord(id),
  pb_health: (id) => deleteHealthRecord(id),
  pb_isolation: (id) => deleteQuarantineRecord(id),
  pb_waste: (id, record) => (isManure(record) ? deleteManureRecord(id) : deleteWasteRecord(id)),
  pb_feed_inventory: (id) => deleteFeedInventory(id),
  pb_feed_consumption: (id) => deleteFeedConsumption(id),
  pb_equipment: (id) => deleteEquipment(id),
  pb_expenses: (id) => deleteExpenseRecord(id),
  pb_personnel: (id) => deletePersonnel(id),
  pb_visitors: (id) => deleteVisitor(id),
  pb_batches: (id) => deleteFlock(id),
  pb_sales: (id) => deleteSalesRecord(id),
  pb_todo: (id, record) => deleteAssignedTaskById(record.personnel._id, id),
  pb_personal_todos: (id) => deletePersonalTodoById(id),
};

export async function archiveRow({ moduleKey, record, reload = true }) {
  if (!record) return;

  let role = "";
  try { role = (JSON.parse(localStorage.getItem("user") || "{}").role || "").toLowerCase(); } catch { }
  if (role !== "owner") {
    alert("Only the Owner can archive records.");
    return;
  }

  const id = record._id ?? record.id;
  const archiveFn = ARCHIVE_FN_BY_MODULE_KEY[moduleKey];

  try {
    if (archiveFn && id) {
      await archiveFn(id, record);
    }
  } catch (err) {
    alert(err?.message || "Couldn't archive this record. Please try again.");
    return;
  }

  try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
  if (reload) window.location.reload();
}