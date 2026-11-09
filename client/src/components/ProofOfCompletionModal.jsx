import { useEffect, useRef, useState } from "react";
import { FiCamera, FiX, FiCheckCircle } from "react-icons/fi";
import "./ProofOfCompletionModal.css";
import { submitTaskProofById } from "../todoStore";
import { useLanguage } from "../i18n/LanguageContext";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // matches server/middleware/taskProofUpload.js
const MAX_REMARKS_LENGTH = 500; // matches server/models/TaskOccurrence.js

const isValidImage = (file) =>
  !!file && typeof file.type === "string" && file.type.startsWith("image/");

// Required Proof of Completion modal. Opened identically whether "Done" is
// clicked from the To Do page or from the Dashboard (same component, same
// behavior) -- there is no separate completion workflow for either place.
//
// Props:
//   task       — { title, category } the occurrence belongs to (display only)
//   occurrence — { _id } the daily/lifetime occurrence being completed
//   onClose()  — called when the modal is dismissed without submitting
//   onSubmitted(updatedOccurrence) — called only after the full save
//                (photo upload + remarks + completion state) has committed
export default function ProofOfCompletionModal({ task, occurrence, onClose, onSubmitted }) {
  const { t: tr } = useLanguage();
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [remarks, setRemarks] = useState("");
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Revoke the previous object URL whenever the selected photo changes or
  // the modal unmounts, so replacing the image before submit never leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!isValidImage(file)) {
      setFileError(tr("Please select a valid image file (JPG, PNG, GIF, or WEBP)."));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setFileError(tr("Image is too large. Maximum file size is 5 MB."));
      return;
    }

    setFileError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const replacePhoto = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const trimmedRemarks = remarks.trim();
  const remarksValid = trimmedRemarks.length > 0 && remarks.length <= MAX_REMARKS_LENGTH;
  const photoValid = !!photoFile && isValidImage(photoFile) && photoFile.size <= MAX_PHOTO_BYTES;
  const canSubmit = photoValid && remarksValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitTaskProofById(occurrence._id, {
        photo: photoFile,
        remarks: trimmedRemarks,
      });
      // Only now -- after upload + remarks + completion state have all
      // actually been saved -- do we show success and tell the parent.
      setSuccess(true);
      if (onSubmitted) onSubmitted(result.occurrence);
    } catch (err) {
      setSubmitError(err?.message || tr("Couldn't submit Proof of Completion. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="poc-overlay" onClick={() => !submitting && onClose()}>
      <div className="poc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="poc-head">
          <h3>{tr("Proof of Completion")}</h3>
          <button className="poc-close" onClick={onClose} disabled={submitting} aria-label={tr("Close")}>
            <FiX />
          </button>
        </div>

        {success ? (
          <div className="poc-success">
            <FiCheckCircle className="poc-success-icon" />
            <p>{tr("Submitted successfully. This task is now marked Completed for today.")}</p>
            <button className="poc-btn-save" onClick={onClose}>{tr("Close")}</button>
          </div>
        ) : (
          <>
            <div className="poc-body">
              <p className="poc-task-title">{task?.title}</p>
              {task?.category && <span className={`poc-category-tag poc-${task.category.toLowerCase()}`}>{tr(task.category)}</span>}

              <div className="poc-field">
                <label>{tr("Photo Proof of Completion")} <span className="poc-required">*</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="poc-file-input"
                  disabled={submitting}
                />
                {!previewUrl ? (
                  <div className="poc-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <FiCamera />
                    <span>{tr("Click to upload a photo showing the completed work")}</span>
                  </div>
                ) : (
                  <div className="poc-preview-wrap">
                    <img src={previewUrl} alt={tr("Photo proof preview")} className="poc-preview-img" />
                    <button type="button" className="poc-replace-btn" onClick={replacePhoto} disabled={submitting}>
                      {tr("Replace Photo")}
                    </button>
                  </div>
                )}
                {fileError && <p className="poc-error">{fileError}</p>}
              </div>

              <div className="poc-field">
                <label>{tr("Remarks")} <span className="poc-required">*</span></label>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={tr("Describe what work was performed...")}
                  maxLength={MAX_REMARKS_LENGTH}
                  disabled={submitting}
                />
                <small className="poc-char-count">{remarks.length} / {MAX_REMARKS_LENGTH}</small>
              </div>

              {submitError && <p className="poc-error poc-submit-error">{submitError}</p>}
            </div>

            <div className="poc-foot">
              <button className="poc-btn-cancel" onClick={onClose} disabled={submitting}>{tr("Cancel")}</button>
              <button className="poc-btn-save" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? tr("Submitting...") : tr("Submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}