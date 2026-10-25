const ONGOING_ISOLATION_STATUSES = ["", "In Isolation"];

export const isOngoingIsolation = (record) =>
  record?.recordType === "Isolation" &&
  !record.archived &&
  ONGOING_ISOLATION_STATUSES.includes(record.currentStatus || "");

export function mortalityBatchOptions(flocks, quarantineRecords, keepBatchId = "") {
  const isolatedBatchIds = new Set(
    quarantineRecords.filter(isOngoingIsolation).map((record) => record.batchId)
  );

  const options = flocks
    .filter(
      (flock) =>
        flock.batchId &&
        !flock.isArchived &&
        flock.status !== "Culled" &&
        !isolatedBatchIds.has(flock.batchId)
    )
    .map((flock) => flock.batchId);

  if (keepBatchId) options.push(keepBatchId);

  return [...new Set(options)];
}