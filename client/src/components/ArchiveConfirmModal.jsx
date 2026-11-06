import "./ArchiveConfirmModal.css";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * ArchiveConfirmModal — same visual design across every page (matches the
 * Logout confirmation and Flock Profile's archive confirmation): cream
 * card, bold title, pill-shaped Cancel/Archive buttons.
 *
 * Pair with useArchiveConfirm() — pass its `pending`, `cancelArchive`,
 * and `confirmArchive` straight through.
 */
export default function ArchiveConfirmModal({ pending, onCancel, onConfirm }) {
  const { t: tr } = useLanguage();
  if (!pending) return null;

  return (
    <div className="pb-confirm-overlay" onClick={onCancel}>
      <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pb-confirm-title">{tr("Archive Record")}</h3>
        <p className="pb-confirm-message">{tr("Move \"")}{pending.name || "this record"}{tr("\" to the archive? You can restore it anytime from the Archive page.")}</p>
        <div className="pb-confirm-actions">
          <button className="pb-confirm-cancel" onClick={onCancel}>{tr("Cancel")}</button>
          <button className="pb-confirm-archive" onClick={onConfirm}>{tr("Archive")}</button>
        </div>
      </div>
    </div>
  );
}