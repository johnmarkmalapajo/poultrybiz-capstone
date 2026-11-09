// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  release: vi.fn(),
  canEdit: { value: true },
}));

vi.mock("../src/api/quarantineIsolation", () => ({
  listQuarantineRecords: (...a) => api.list(...a),
  releaseQuarantineRecord: (...a) => api.release(...a),
  updateIsolationProgress: vi.fn(),
  correctIsolationProgress: vi.fn(),
}));
vi.mock("../src/api/profile", () => ({ getFarmInfo: () => Promise.resolve({}) }));
vi.mock("../src/hooks/useUser", () => ({ useUser: () => ({ canEdit: api.canEdit.value, canArchive: true }) }));
vi.mock("../src/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s) => s }) }));
vi.mock("../src/components/PageLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../src/components/ExportMenu", () => ({ default: () => null }));
vi.mock("../src/components/ArchiveConfirmModal", () => ({ default: () => null }));
vi.mock("../src/hooks/useArchiveConfirm", () => ({
  useArchiveConfirm: () => ({ pending: null, requestArchive: vi.fn(), cancelArchive: vi.fn(), confirmArchive: vi.fn() }),
}));
vi.mock("../src/archiveRow", () => ({ archiveRow: vi.fn() }));
vi.mock("../src/pages/QuarantineandIsolation.css", () => ({}));

import QuarantineIsolation from "../src/pages/QuarantineandIsolation.jsx";
import { phToday } from "../src/phDate.js";

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysAgo = (n) => addDays(phToday(), -n);

const rows = () => [
  { _id: "a", recordType: "Quarantine", batchId: "B-NEW", breed: "Hy-Line", source: "S", dateAcquired: daysAgo(0), headCount: 100, status: "Ongoing", releasedDate: "", quarantineDurationDays: 0 },
  { _id: "b", recordType: "Quarantine", batchId: "B-ONE", breed: "Hy-Line", source: "S", dateAcquired: daysAgo(1), headCount: 50, status: "Ongoing", releasedDate: "", quarantineDurationDays: 1 },
  { _id: "c", recordType: "Quarantine", batchId: "B-FIVE", breed: "Hy-Line", source: "S", dateAcquired: daysAgo(5), headCount: 40, status: "Ongoing", releasedDate: "", quarantineDurationDays: 5 },
  { _id: "d", recordType: "Quarantine", batchId: "B-REL", breed: "Hy-Line", source: "S", dateAcquired: daysAgo(40), headCount: 30, status: "Released", releasedDate: daysAgo(26), quarantineDurationDays: 14 },
];

const mount = async () => {
  render(<MemoryRouter><QuarantineIsolation /></MemoryRouter>);
  await screen.findByText("B-NEW");
};
const rowOf = (batch) => within(document.querySelector("table")).getByText(batch).closest("tr");
const openModal = async (batch = "B-FIVE") => {
  await mount();
  fireEvent.click(within(rowOf(batch)).getByRole("button", { name: /Ongoing/ }));
  return screen.getByRole("dialog");
};
const confirmBtn = () => screen.getByRole("button", { name: /Confirm Release|Releasing/ });

beforeEach(() => {
  api.canEdit.value = true;
  api.list.mockReset().mockImplementation(() => Promise.resolve({ records: rows() }));
  api.release.mockReset().mockResolvedValue({ success: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Quarantine Duration column", () => {
  it("has the column header and shows '0 days', '1 day', '5 days' for Ongoing rows (live, Philippine date)", async () => {
    await mount();
    expect(screen.getByText("QUARANTINE DURATION")).toBeTruthy();
    expect(within(rowOf("B-NEW")).getByText("0 days")).toBeTruthy();
    expect(within(rowOf("B-ONE")).getByText("1 day")).toBeTruthy();
    expect(within(rowOf("B-FIVE")).getByText("5 days")).toBeTruthy();
  });

  it("Released row shows its FINAL duration (14 days), not days since the start date (40)", async () => {
    await mount();
    const r = rowOf("B-REL");
    expect(within(r).getByText("14 days")).toBeTruthy();
    expect(within(r).queryByText("40 days")).toBeNull();
  });

  it("shows an em dash when the duration cannot be determined (no start date, no server value)", async () => {
    api.list.mockResolvedValue({ records: [{ _id: "x", recordType: "Quarantine", batchId: "B-NONE", dateAcquired: "", headCount: 1, status: "Ongoing" }] });
    render(<MemoryRouter><QuarantineIsolation /></MemoryRouter>);
    await screen.findByText("B-NONE");
    const cells = rowOf("B-NONE").querySelectorAll("td");
    expect(cells[7].textContent).toBe("—");
  });

  it("an open page rolls an Ongoing duration over at 12:00 AM Manila time (4 -> 5 days)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-11-06T15:59:30Z")); // 23:59:30 on Nov 6 in Manila
    api.list.mockResolvedValue({ records: [{ _id: "z", recordType: "Quarantine", batchId: "B-MID", dateAcquired: "2026-11-02", headCount: 10, status: "Ongoing", quarantineDurationDays: 4 }] });
    render(<MemoryRouter><QuarantineIsolation /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(within(rowOf("B-MID")).getByText("4 days")).toBeTruthy();
    await act(async () => { vi.setSystemTime(new Date("2026-11-06T16:00:30Z")); vi.advanceTimersByTime(60000); });
    expect(within(rowOf("B-MID")).getByText("5 days")).toBeTruthy();
  });
});

describe("Status control", () => {
  it("Ongoing rows have a clickable status; Released rows do not", async () => {
    await mount();
    expect(within(rowOf("B-FIVE")).getByRole("button", { name: /Ongoing/ })).toBeTruthy();
    expect(within(rowOf("B-REL")).queryByRole("button")).toBeNull();
  });

  it("users who cannot edit (e.g. Visitor) get no status button", async () => {
    api.canEdit.value = false;
    await mount();
    expect(within(rowOf("B-FIVE")).queryByRole("button")).toBeNull();
  });

  it("clicking Ongoing does NOT release anything -- it only opens the dialog", async () => {
    await openModal();
    expect(api.release).not.toHaveBeenCalled();
    expect(within(rowOf("B-FIVE")).getByText(/Ongoing/)).toBeTruthy();
  });
});

describe("Release Quarantine Record dialog", () => {
  it("shows title, question, both choices, Cancel + Confirm; no number input and Confirm disabled until a choice is made", async () => {
    const dlg = await openModal();
    expect(within(dlg).getByText("Release Quarantine Record")).toBeTruthy();
    expect(within(dlg).getByText("Did any birds die during this quarantine period?")).toBeTruthy();
    expect(within(dlg).getByRole("radio", { name: "Yes, there were deaths." })).toBeTruthy();
    expect(within(dlg).getByRole("radio", { name: "No deaths." })).toBeTruthy();
    expect(within(dlg).queryByLabelText("Number of Deceased Birds")).toBeNull();
    expect(within(dlg).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(confirmBtn().disabled).toBe(true);
  });

  it("YES shows the 'Number of Deceased Birds' input (and only then)", async () => {
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    expect(within(dlg).getByLabelText("Number of Deceased Birds")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("radio", { name: "No deaths." }));
    expect(within(dlg).queryByLabelText("Number of Deceased Birds")).toBeNull();
  });

  it("YES: Confirm stays disabled for empty, zero and over-limit; decimals/negatives/letters cannot be typed", async () => {
    const dlg = await openModal("B-FIVE"); // head count 40
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    const input = within(dlg).getByLabelText("Number of Deceased Birds");
    expect(confirmBtn().disabled).toBe(true); // empty
    fireEvent.change(input, { target: { value: "0" } });
    expect(confirmBtn().disabled).toBe(true); // zero
    fireEvent.change(input, { target: { value: "41" } });
    expect(confirmBtn().disabled).toBe(true); // more than the 40 birds
    fireEvent.change(input, { target: { value: "-3" } });
    expect(input.value).toBe("3"); // '-' stripped, never negative
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(input.value).toBe("25"); // '.' stripped, never a decimal
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "40" } });
    expect(confirmBtn().disabled).toBe(false); // exactly the head count is allowed
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(api.release).toHaveBeenCalledTimes(1));
    expect(api.release).toHaveBeenCalledWith("c", { hadDeaths: true, deceasedCount: 40 });
  });

  it("YES + valid quantity -> one request with the quantity only (no batch id/date typed by the user); dialog closes and list reloads", async () => {
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    fireEvent.change(within(dlg).getByLabelText("Number of Deceased Birds"), { target: { value: "7" } });
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.release).toHaveBeenCalledTimes(1);
    expect(api.release).toHaveBeenCalledWith("c", { hadDeaths: true, deceasedCount: 7 });
    expect(api.list.mock.calls.length).toBeGreaterThanOrEqual(2); // initial load + reload after release
  });

  it("NO -> Confirm is enabled right away and sends hadDeaths:false with no quantity", async () => {
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "No deaths." }));
    expect(confirmBtn().disabled).toBe(false);
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(api.release).toHaveBeenCalledTimes(1));
    expect(api.release).toHaveBeenCalledWith("c", { hadDeaths: false });
  });

  it("switching YES(7) -> NO drops the typed quantity (never sent)", async () => {
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    fireEvent.change(within(dlg).getByLabelText("Number of Deceased Birds"), { target: { value: "7" } });
    fireEvent.click(within(dlg).getByRole("radio", { name: "No deaths." }));
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(api.release).toHaveBeenCalledTimes(1));
    expect(api.release).toHaveBeenCalledWith("c", { hadDeaths: false });
  });

  it("DOUBLE-CLICK on Confirm Release sends ONE request; button disables and says 'Releasing...' meanwhile", async () => {
    let resolve;
    api.release.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    fireEvent.change(within(dlg).getByLabelText("Number of Deceased Birds"), { target: { value: "3" } });
    const btn = confirmBtn();
    fireEvent.click(btn);
    fireEvent.click(btn); // second click lands before React re-renders
    fireEvent.click(btn);
    expect(api.release).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Releasing..." }).disabled).toBe(true));
    expect(within(dlg).getByRole("button", { name: "Cancel" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Releasing..." }));
    expect(api.release).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ success: true }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.release).toHaveBeenCalledTimes(1);
  });

  it("CANCEL closes the dialog with no request and leaves the status Ongoing", async () => {
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "Yes, there were deaths." }));
    fireEvent.change(within(dlg).getByLabelText("Number of Deceased Birds"), { target: { value: "3" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.release).not.toHaveBeenCalled();
    expect(within(rowOf("B-FIVE")).getByRole("button", { name: /Ongoing/ })).toBeTruthy();
    // reopening starts clean
    fireEvent.click(within(rowOf("B-FIVE")).getByRole("button", { name: /Ongoing/ }));
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.queryByLabelText("Number of Deceased Birds")).toBeNull();
  });

  it("clicking the dark backdrop also cancels without a request", async () => {
    await openModal();
    fireEvent.click(document.querySelector(".pb-confirm-overlay"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.release).not.toHaveBeenCalled();
  });

  it("server error: message shown in the dialog, dialog stays open, button works again, table is reloaded", async () => {
    api.release.mockRejectedValueOnce(Object.assign(new Error("This Quarantine record has already been released."), { status: 409 }));
    const dlg = await openModal();
    fireEvent.click(within(dlg).getByRole("radio", { name: "No deaths." }));
    const loadsBefore = api.list.mock.calls.length;
    fireEvent.click(confirmBtn());
    expect(await screen.findByText("This Quarantine record has already been released.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(confirmBtn().disabled).toBe(false);
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(loadsBefore));
  });
});