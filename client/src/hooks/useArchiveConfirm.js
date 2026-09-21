import { useState } from "react";
import { archiveRow } from "../archiveRow";

/**
 * useArchiveConfirm — adds a confirmation step in front of archiveRow()
 * so every page shows the same styled dialog (see ArchiveConfirmModal)
 * instead of archiving immediately on click.
 *
 * Usage:
 *   const { pending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
 *   ...
 *   <button onClick={() => requestArchive({ module, moduleKey, record: r, name: r.name })}>
 *   ...
 *   <ArchiveConfirmModal pending={pending} onCancel={cancelArchive} onConfirm={confirmArchive} />
 *
 * Pass onArchived if the page needs to re-fetch instead of relying on
 * archiveRow's default full-page reload (i.e. when you'd normally pass
 * `reload: false` directly to archiveRow).
 */
export function useArchiveConfirm(onArchived) {
  const [pending, setPending] = useState(null);

  const requestArchive = (args) => setPending(args);
  const cancelArchive = () => setPending(null);

  const confirmArchive = async () => {
    if (!pending) return;
    const { onArchived: perCallOnArchived, ...rest } = pending;
    try {
      await archiveRow(onArchived || perCallOnArchived ? { ...rest, reload: false } : rest);
      if (perCallOnArchived) await perCallOnArchived();
      else if (onArchived) await onArchived();
    } finally {
      setPending(null);
    }
  };

  return { pending, requestArchive, cancelArchive, confirmArchive };
}
