import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiFileText,
  FiInfo,
  FiSave,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddExpense.css";
import { createExpenseRecord, uploadReceipt } from "../api/expenseRecord";

const CATEGORIES = [
  "Feed Purchase",
  "Medicine",
  "Utilities",
  "Labor",
  "Equipment",
  "Transportation",
  "Miscellaneous",
];

const FEED_SACK_WEIGHT_KG = 50;

// Blocks "-", "+", "e"/"E" from being typed into number inputs so users
// can't enter negative amounts/quantities via the keyboard.
const blockInvalidNumberKeys = (e) => {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
};

// Blocks pasting anything that isn't a plain non-negative number.
const blockInvalidNumberPaste = (e) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d*\.?\d*$/.test(text)) {
    e.preventDefault();
  }
};

// Today's date as YYYY-MM-DD, used as the max for date inputs so users
// can't pick a future date.
const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createFeedSet = () => ({
  feedType: "",
  unit: "Sacks",
  quantity: "",
  unitPrice: "",
  receipt: null,
});

// Subtotal for one feed set row: quantity × unit price.
const feedSetSubtotal = (feedSet) =>
  Number(feedSet.quantity || 0) * Number(feedSet.unitPrice || 0);

export default function AddExpense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const presetCategory = searchParams.get("category");

  const [form, setForm] = useState({
    date: "",
    category:
      presetCategory === "Feed Purchase"
        ? "Feed Purchase"
        : presetCategory === "Equipment"
        ? "Equipment"
        : "",
    amount: "",
    receipt: null,
    supplier: "",
    remarks: "",
    // Equipment-category fields
    equipmentName: "",
    unit: "",
    quantity: "",
    serialNo: "",
    description: "",
  });

  const [feedSets, setFeedSets] = useState([
    createFeedSet(),
  ]);

  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isFeedPurchase =
    form.category === "Feed Purchase";

  const isEquipment =
    form.category === "Equipment";

  useEffect(() => {
    if (presetCategory === "Feed Purchase") {
      setForm((current) => ({
        ...current,
        category: "Feed Purchase",
      }));
    }

    if (presetCategory === "Equipment") {
      setForm((current) => ({
        ...current,
        category: "Equipment",
      }));
    }
  }, [presetCategory]);

  const totalQuantityKg = feedSets.reduce(
    (total, feedSet) => {
      const quantity = Number(feedSet.quantity || 0);

      if (feedSet.unit === "Sacks") {
        return (
          total +
          quantity * FEED_SACK_WEIGHT_KG
        );
      }

      return total + quantity;
    },
    0
  );

  const totalAmount = feedSets.reduce(
    (total, feedSet) =>
      total + feedSetSubtotal(feedSet),
    0
  );

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFeedSetChange = (
    index,
    field,
    value
  ) => {
    setFeedSets((current) =>
      current.map((feedSet, feedSetIndex) =>
        feedSetIndex === index
          ? {
              ...feedSet,
              [field]: value,
            }
          : feedSet
      )
    );
  };

  const addFeedSet = () => {
    setFeedSets((current) => [
      ...current,
      createFeedSet(),
    ]);
  };

  const removeFeedSet = (index) => {
    setFeedSets((current) =>
      current.filter(
        (_, feedSetIndex) =>
          feedSetIndex !== index
      )
    );
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setForm((current) => ({
      ...current,
      receipt: file,
    }));

    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview("");
    }
  };

  const handleFeedReceipt = (index, e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    handleFeedSetChange(
      index,
      "receipt",
      file
    );
  };

  const removeFile = () => {
    setForm((current) => ({
      ...current,
      receipt: null,
    }));

    setPreview("");
  };

  const removeFeedReceipt = (index) => {
    handleFeedSetChange(
      index,
      "receipt",
      null
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving || window.__pbSaving) {
      return;
    }

    setError("");
    setSuccess("");

    window.__pbSaving = true;
    setSaving(true);

    try {
      if (!form.date) {
        throw new Error(
          "Please select the expense date."
        );
      }

      if (form.date > getTodayDateString()) {
        throw new Error(
          "The date cannot be in the future."
        );
      }

      if (!form.category) {
        throw new Error(
          "Please select an expense category."
        );
      }

      if (isFeedPurchase) {
        const hasInvalidFeedSet =
          feedSets.some(
            (feedSet) =>
              !feedSet.feedType ||
              !feedSet.quantity ||
              Number.isNaN(Number(feedSet.quantity)) ||
              Number(feedSet.quantity) <= 0 ||
              !feedSet.unitPrice ||
              Number.isNaN(Number(feedSet.unitPrice)) ||
              Number(feedSet.unitPrice) < 0
          );

        if (hasInvalidFeedSet) {
          throw new Error(
            "Please complete all required feed purchase fields."
          );
        }

        if (!form.supplier.trim()) {
          throw new Error(
            "Please enter the supplier name."
          );
        }
      }

      if (isEquipment) {
        if (!form.equipmentName.trim()) {
          throw new Error(
            "Please enter the equipment/tool name."
          );
        }

        if (!form.description.trim()) {
          throw new Error(
            "Please enter the description/specification."
          );
        }

        if (!form.unit.trim()) {
          throw new Error(
            "Please select a unit."
          );
        }

        if (
          !form.quantity ||
          Number.isNaN(Number(form.quantity)) ||
          Number(form.quantity) <= 0
        ) {
          throw new Error(
            "Please enter a valid quantity."
          );
        }

        if (
          form.amount === "" ||
          Number.isNaN(Number(form.amount)) ||
          Number(form.amount) < 0
        ) {
          throw new Error(
            "Please enter a valid amount."
          );
        }
      }

      if (!isFeedPurchase && !isEquipment) {
        if (
          form.amount === "" ||
          Number.isNaN(Number(form.amount)) ||
          Number(form.amount) < 0
        ) {
          throw new Error(
            "Please enter a valid amount."
          );
        }
      }

      let uploadedReceiptPath = null;

      if (form.receipt) {
        const uploadResult = await uploadReceipt(
          form.receipt
        );
        uploadedReceiptPath = uploadResult.receipt;
      }

      const payload = isFeedPurchase
        ? {
            date: form.date,
            category: "Feed Purchase",
            supplier: form.supplier.trim(),
            remarks: form.remarks.trim(),
            receipt: uploadedReceiptPath,

            feedSets: feedSets.map(
              (feedSet) => {
                const quantity = Number(
                  feedSet.quantity
                );

                const equivalentKg =
                  feedSet.unit === "Sacks"
                    ? quantity *
                      FEED_SACK_WEIGHT_KG
                    : quantity;

                return {
                  feedType:
                    feedSet.feedType,
                  unit: feedSet.unit,
                  quantity,
                  unitPrice: Number(
                    feedSet.unitPrice
                  ),
                  amount:
                    quantity *
                    Number(feedSet.unitPrice),
                  equivalentKg,
                  receipt:
                    feedSet.receipt
                      ? feedSet.receipt.name
                      : null,
                };
              }
            ),

            totalQuantityKg,
            totalAmount,

            amount: totalAmount,
          }
        : isEquipment
        ? {
            date: form.date,
            category: "Equipment",
            amount: Number(form.amount),
            unit: form.unit,
            quantity: Number(form.quantity),
            serialNo: form.serialNo.trim(),
            description: form.description.trim(),
            equipmentName: form.equipmentName.trim(),
            remarks: form.remarks.trim(),
            receipt: uploadedReceiptPath,
          }
        : {
            date: form.date,
            category: form.category,
            amount: Number(form.amount),
            remarks: form.remarks.trim(),
            receipt: uploadedReceiptPath,
          };

      await createExpenseRecord(payload);

      setSuccess(
        "Expense record saved successfully!"
      );

      setForm({
        date: "",
        category:
          presetCategory === "Feed Purchase"
            ? "Feed Purchase"
            : presetCategory === "Equipment"
            ? "Equipment"
            : "",
        amount: "",
        receipt: null,
        supplier: "",
        remarks: "",
        equipmentName: "",
        unit: "",
        quantity: "",
        serialNo: "",
        description: "",
      });

      setFeedSets([createFeedSet()]);
      setPreview("");

      try {
        window.dispatchEvent(
          new Event("pb_data_changed")
        );
      } catch {}

      setTimeout(() => {
        navigate(
          isEquipment
            ? "/inventory/equipment"
            : isFeedPurchase
            ? "/inventory/feed-inventory"
            : "/sales-transactions/expenses"
        );
      }, 1000);
    } catch (err) {
      setError(
        err?.message ||
          "Cannot connect to server. Please try again."
      );
    } finally {
      setSaving(false);
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        {
          label: "SALES AND TRANSACTIONS",
          path: "/sales-transactions",
        },
        {
          label: "EXPENSES RECORD",
          path: "/sales-transactions/expenses",
        },
        {
          label: "ADD EXPENSE",
        },
      ]}
    >
      {success && (
        <div className="ae-success-banner">
          {success}
        </div>
      )}

      {error && (
        <div className="ae-error-banner">
          {error}
        </div>
      )}

      <form
        className="ae-form-card"
        onSubmit={handleSubmit}
      >
        <div className="ae-section-header">
          <FiInfo />
          <h3>Expense Details</h3>
          <div className="ae-line" />
        </div>

        <div className="ae-form-grid">
          <div className="ae-form-group">
            <label>
              {isFeedPurchase
                ? "Date Purchased"
                : "Expense Date"}{" "}
              <span className="req">*</span>
            </label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              max={getTodayDateString()}
              required
            />
          </div>

          <div className="ae-form-group">
            <label>
              Category{" "}
              <span className="req">*</span>
            </label>

            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="">
                Select category
              </option>

              {CATEGORIES.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>
          </div>

          {isEquipment ? (
            <>
              <div className="ae-form-group">
                <label>
                  Equipment/Tool Name{" "}
                  <span className="req">*</span>
                </label>

                <input
                  type="text"
                  name="equipmentName"
                  value={form.equipmentName}
                  onChange={handleChange}
                  placeholder="Enter equipment/tool name"
                  required
                />
              </div>

              <div className="ae-form-group">
                <label>
                  Serial/ID No.{" "}
                  <span className="ae-optional">
                    (optional)
                  </span>
                </label>

                <input
                  type="text"
                  name="serialNo"
                  value={form.serialNo}
                  onChange={handleChange}
                  placeholder="Enter serial or ID number"
                />
              </div>

              <div className="ae-form-group ae-full-width">
                <label>
                  Description/Specification{" "}
                  <span className="req">*</span>
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter description or specification"
                  required
                />
              </div>

              <div className="ae-form-group">
                <label>
                  Quantity{" "}
                  <span className="req">*</span>
                </label>

                <input
                  type="number"
                  name="quantity"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={handleChange}
                  onKeyDown={blockInvalidNumberKeys}
                  onPaste={blockInvalidNumberPaste}
                  placeholder="Enter quantity"
                  required
                />
              </div>

              <div className="ae-form-group">
                <label>
                  Unit{" "}
                  <span className="req">*</span>
                </label>

                <select
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select unit</option>
                  <option value="pcs">pcs</option>
                  <option value="units">units</option>
                  <option value="sets">sets</option>
                  <option value="pairs">pairs</option>
                  <option value="kg">kg</option>
                  <option value="liters">liters</option>
                </select>
              </div>

              <div className="ae-form-group">
                <label>
                  Amount{" "}
                  <span className="req">*</span>
                </label>

                <div className="ae-input-with-prefix">
                  <span className="ae-prefix">₱</span>

                  <input
                    type="number"
                    name="amount"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={handleChange}
                    onKeyDown={blockInvalidNumberKeys}
                    onPaste={blockInvalidNumberPaste}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="ae-form-group">
                <label>
                  Receipt{" "}
                  <span className="ae-optional">
                    (optional)
                  </span>
                </label>

                <div className="ae-file-wrap">
                  <label className="ae-file-btn">
                    <FiUpload />
                    Choose file

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFile}
                      hidden
                    />
                  </label>

                  <span className="ae-file-name">
                    {form.receipt
                      ? form.receipt.name
                      : "No file chosen"}
                  </span>
                </div>

                {preview && (
                  <div className="ae-file-preview">
                    <img
                      src={preview}
                      alt="Receipt preview"
                    />

                    <button
                      type="button"
                      className="ae-file-remove"
                      onClick={removeFile}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <small>
                  Upload a receipt image or PDF (max 5MB). JPG, PNG, or PDF.
                </small>
              </div>
            </>
          ) : isFeedPurchase ? (
            <>
              <div className="ae-form-group">
                <label>
                  Feed Type{" "}
                  <span className="req">*</span>
                </label>

                <select
                  value={
                    feedSets[0].feedType
                  }
                  onChange={(e) =>
                    handleFeedSetChange(
                      0,
                      "feedType",
                      e.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select feed type
                  </option>

                  <option value="Layer Feed">
                    Layer Feed
                  </option>

                  <option value="Grower Feed">
                    Grower Feed
                  </option>
                </select>
              </div>

              <div className="ae-form-group">
                <label>
                  Supplier{" "}
                  <span className="req">*</span>
                </label>

                <input
                  type="text"
                  name="supplier"
                  value={form.supplier}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
                  required
                />
              </div>

              <div className="ae-form-group">
                <label>
                  Quantity{" "}
                  <span className="req">*</span>
                </label>

                <div className="ae-quantity-unit">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      feedSets[0].quantity
                    }
                    onChange={(e) =>
                      handleFeedSetChange(
                        0,
                        "quantity",
                        e.target.value
                      )
                    }
                    onKeyDown={blockInvalidNumberKeys}
                    onPaste={blockInvalidNumberPaste}
                    placeholder="Enter quantity"
                    required
                  />

                  <select
                    value={
                      feedSets[0].unit
                    }
                    onChange={(e) =>
                      handleFeedSetChange(
                        0,
                        "unit",
                        e.target.value
                      )
                    }
                    required
                  >
                    <option value="Sacks">
                      sacks
                    </option>

                    <option value="Kilogram">
                      kg
                    </option>
                  </select>
                </div>

                <small className="ae-unit-equivalent">
                  {feedSets[0].unit ===
                  "Sacks"
                    ? "1 sack is equal to 50 kg."
                    : "50 kg is equal to 1 sack."}
                </small>
              </div>

              <div className="ae-form-group">
                <label>
                  Price per{" "}
                  {feedSets[0].unit === "Sacks"
                    ? "Sack"
                    : "Kg"}{" "}
                  <span className="req">*</span>
                </label>

                <div className="ae-input-with-prefix">
                  <span className="ae-prefix">
                    ₱
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      feedSets[0].unitPrice
                    }
                    onChange={(e) =>
                      handleFeedSetChange(
                        0,
                        "unitPrice",
                        e.target.value
                      )
                    }
                    onKeyDown={blockInvalidNumberKeys}
                    onPaste={blockInvalidNumberPaste}
                    placeholder="Enter price per unit"
                    required
                  />
                </div>
              </div>

              <div className="ae-form-group">
                <label>Subtotal</label>

                <div className="ae-input-with-prefix">
                  <span className="ae-prefix">
                    ₱
                  </span>

                  <input
                    type="text"
                    value={feedSetSubtotal(
                      feedSets[0]
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    placeholder="Subtotal"
                    disabled
                    readOnly
                  />
                </div>
              </div>

              <div className="ae-form-group">
                <label>
                  Receipt{" "}
                  <span className="ae-optional">
                    (optional)
                  </span>
                </label>

                <div className="ae-file-wrap">
                  <label className="ae-file-btn">
                    <FiUpload />
                    Choose file

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFile}
                      hidden
                    />
                  </label>

                  <span className="ae-file-name">
                    {form.receipt
                      ? form.receipt.name
                      : "No file chosen"}
                  </span>
                </div>

                {preview && (
                  <div className="ae-file-preview">
                    <img
                      src={preview}
                      alt="Receipt preview"
                    />

                    <button
                      type="button"
                      className="ae-file-remove"
                      onClick={removeFile}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <small>
                  Upload a receipt image or PDF
                  (max 5MB). JPG, PNG, or PDF.
                </small>
              </div>

              <div className="ae-feed-sets">
                {feedSets
                  .slice(1)
                  .map(
                    (
                      feedSet,
                      index
                    ) => {
                      const actualIndex =
                        index + 1;

                      return (
                        <div
                          className="ae-feed-set"
                          key={actualIndex}
                        >
                          <div className="ae-feed-set-header">
                            <span>
                              Feed Set{" "}
                              {actualIndex + 1}
                            </span>

                            <button
                              type="button"
                              className="ae-remove-feed-set"
                              onClick={() =>
                                removeFeedSet(
                                  actualIndex
                                )
                              }
                            >
                              <FiTrash2 />
                              Remove
                            </button>
                          </div>

                          <div className="ae-feed-set-grid">
                            <div className="ae-form-group">
                              <label>
                                Feed Type{" "}
                                <span className="req">
                                  *
                                </span>
                              </label>

                              <select
                                value={
                                  feedSet.feedType
                                }
                                onChange={(e) =>
                                  handleFeedSetChange(
                                    actualIndex,
                                    "feedType",
                                    e.target.value
                                  )
                                }
                                required
                              >
                                <option value="">
                                  Select feed type
                                </option>

                                <option value="Layer Feed">
                                  Layer Feed
                                </option>

                                <option value="Grower Feed">
                                  Grower Feed
                                </option>
                              </select>
                            </div>

                            <div className="ae-form-group">
                              <label>
                                Quantity{" "}
                                <span className="req">
                                  *
                                </span>
                              </label>

                              <div className="ae-quantity-unit">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={
                                    feedSet.quantity
                                  }
                                  onChange={(e) =>
                                    handleFeedSetChange(
                                      actualIndex,
                                      "quantity",
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={blockInvalidNumberKeys}
                                  onPaste={blockInvalidNumberPaste}
                                  placeholder="Enter quantity"
                                  required
                                />

                                <select
                                  value={
                                    feedSet.unit
                                  }
                                  onChange={(e) =>
                                    handleFeedSetChange(
                                      actualIndex,
                                      "unit",
                                      e.target.value
                                    )
                                  }
                                  required
                                >
                                  <option value="Sacks">
                                    sacks
                                  </option>

                                  <option value="Kilogram">
                                    kg
                                  </option>
                                </select>
                              </div>

                              <small className="ae-unit-equivalent">
                                {feedSet.unit ===
                                "Sacks"
                                  ? "1 sack is equal to 50 kg."
                                  : "50 kg is equal to 1 sack."}
                              </small>
                            </div>

                            <div className="ae-form-group">
                              <label>
                                Price per{" "}
                                {feedSet.unit ===
                                "Sacks"
                                  ? "Sack"
                                  : "Kg"}{" "}
                                <span className="req">
                                  *
                                </span>
                              </label>

                              <div className="ae-input-with-prefix">
                                <span className="ae-prefix">
                                  ₱
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    feedSet.unitPrice
                                  }
                                  onChange={(e) =>
                                    handleFeedSetChange(
                                      actualIndex,
                                      "unitPrice",
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={blockInvalidNumberKeys}
                                  onPaste={blockInvalidNumberPaste}
                                  placeholder="Enter price per unit"
                                  required
                                />
                              </div>
                            </div>

                            <div className="ae-form-group">
                              <label>Subtotal</label>

                              <div className="ae-input-with-prefix">
                                <span className="ae-prefix">
                                  ₱
                                </span>

                                <input
                                  type="text"
                                  value={feedSetSubtotal(
                                    feedSet
                                  ).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}
                                  placeholder="Subtotal"
                                  disabled
                                  readOnly
                                />
                              </div>
                            </div>

                            <div className="ae-form-group ae-feed-receipt">
                              <label>
                                Receipt{" "}
                                <span className="ae-optional">
                                  (optional)
                                </span>
                              </label>

                              <div className="ae-file-wrap">
                                <label className="ae-file-btn">
                                  <FiUpload />
                                  Choose file

                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={(e) =>
                                      handleFeedReceipt(
                                        actualIndex,
                                        e
                                      )
                                    }
                                    hidden
                                  />
                                </label>

                                <span className="ae-file-name">
                                  {feedSet.receipt
                                    ? feedSet
                                        .receipt
                                        .name
                                    : "No file chosen"}
                                </span>
                              </div>

                              {feedSet.receipt && (
                                <button
                                  type="button"
                                  className="ae-file-remove"
                                  onClick={() =>
                                    removeFeedReceipt(
                                      actualIndex
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              )}

                              <small>
                                Upload a receipt image
                                or PDF. JPG, PNG, or
                                PDF.
                              </small>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
              </div>

              <button
                type="button"
                className="ae-add-feed-set"
                onClick={addFeedSet}
              >
                + Add Another Feed Set
              </button>

              <div className="ae-feed-summary">
                <div className="ae-summary-card">
                  <span>
                    Total Quantity
                  </span>

                  <strong>
                    {totalQuantityKg.toLocaleString()}{" "}
                    kg
                  </strong>
                </div>

                <div className="ae-summary-card">
                  <span>
                    Grand Total
                  </span>

                  <strong>
                    ₱
                    {totalAmount.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="ae-form-group">
                <label>
                  Amount{" "}
                  <span className="req">*</span>
                </label>

                <div className="ae-input-with-prefix">
                  <span className="ae-prefix">
                    ₱
                  </span>

                  <input
                    type="number"
                    name="amount"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={handleChange}
                    onKeyDown={blockInvalidNumberKeys}
                    onPaste={blockInvalidNumberPaste}
                    placeholder="Enter amount"
                    required
                  />
                </div>
              </div>

              <div className="ae-form-group">
                <label>
                  Receipt{" "}
                  <span className="ae-optional">
                    (optional)
                  </span>
                </label>

                <div className="ae-file-wrap">
                  <label className="ae-file-btn">
                    <FiUpload />
                    Choose file

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFile}
                      hidden
                    />
                  </label>

                  <span className="ae-file-name">
                    {form.receipt
                      ? form.receipt.name
                      : "No file chosen"}
                  </span>
                </div>

                {preview && (
                  <div className="ae-file-preview">
                    <img
                      src={preview}
                      alt="Receipt preview"
                    />

                    <button
                      type="button"
                      className="ae-file-remove"
                      onClick={removeFile}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <small>
                  Upload a receipt image or PDF
                  (max 5MB). JPG, PNG, or PDF.
                </small>
              </div>
            </>
          )}
        </div>

        <div className="ae-section-header">
          <FiFileText />
          <h3>Additional Details</h3>
          <div className="ae-line" />
        </div>

        <div className="ae-form-group ae-full-width">
          <label>
            Remarks{" "}
            <span className="ae-optional">
              (optional)
            </span>
          </label>

          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            placeholder="Enter remarks or notes about this expense..."
            maxLength={255}
          />

          <small className="ae-char-count">
            {form.remarks.length} / 255
          </small>
        </div>

        <div className="ae-form-actions">
          <p className="ae-required-note">
            Fields with * are required.
          </p>

          <div className="ae-action-btns">
            <button
              type="button"
              className="ae-cancel-btn"
              onClick={() =>
                navigate(
                  "/sales-transactions/expenses"
                )
              }
              disabled={saving}
            >
              <FiX />
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="ae-save-btn"
            >
              <FiSave />
              {saving
                ? "Saving..."
                : "Save Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}