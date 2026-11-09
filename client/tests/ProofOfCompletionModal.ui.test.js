// @vitest-environment jsdom
//
// Covers the required Proof of Completion modal introduced by the To Do
// module redesign (Primary/Secondary tasks). Exercises the client-side
// half of testing scenarios #8, #9, #10 and #11 from the spec:
//   8.  Submission without Photo Proof is blocked.
//   9.  Submission without Remarks is blocked.
//   10. Valid photo and remarks are saved successfully.
//   11. Task completion updates immediately after submission.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const store = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock("../src/todoStore", () => ({
  submitTaskProofById: (...a) => store.submit(...a),
}));
vi.mock("../src/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s) => s }) }));

import ProofOfCompletionModal from "../src/components/ProofOfCompletionModal.jsx";

beforeEach(() => {
  store.submit.mockReset().mockResolvedValue({ occurrence: { _id: "occ-1", status: "Completed" } });
  // jsdom doesn't implement the object URL APIs the modal uses for the
  // image preview.
  global.URL.createObjectURL = vi.fn(() => "blob:mock-preview");
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

const task = { title: "Refill water dispensers", category: "Primary" };
const occurrence = { _id: "occ-1", status: "Pending" };

const mount = (onSubmitted = vi.fn(), onClose = vi.fn()) => {
  render(
    <ProofOfCompletionModal task={task} occurrence={occurrence} onClose={onClose} onSubmitted={onSubmitted} />
  );
};

const submitBtn = () => screen.getByRole("button", { name: /^Submit$/ });
const fileInput = () => document.querySelector('input[type="file"]');
const remarksBox = () => screen.getByPlaceholderText("Describe what work was performed...");

const pngFile = (name = "proof.png") => new File(["x"], name, { type: "image/png" });
const txtFile = (name = "proof.txt") => new File(["x"], name, { type: "text/plain" });

describe("ProofOfCompletionModal — required photo + remarks", () => {
  it("disables Submit when neither photo nor remarks are provided", () => {
    mount();
    expect(submitBtn().disabled).toBe(true);
  });

  it("keeps Submit disabled with a photo but empty remarks", () => {
    mount();
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    expect(submitBtn().disabled).toBe(true);
  });

  it("keeps Submit disabled with remarks but no photo", () => {
    mount();
    fireEvent.change(remarksBox(), { target: { value: "Fed and watered the flock." } });
    expect(submitBtn().disabled).toBe(true);
  });

  it("keeps Submit disabled when remarks are whitespace-only", () => {
    mount();
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    fireEvent.change(remarksBox(), { target: { value: "   " } });
    expect(submitBtn().disabled).toBe(true);
  });

  it("rejects a non-image file and keeps Submit disabled", () => {
    mount();
    fireEvent.change(fileInput(), { target: { files: [txtFile()] } });
    expect(screen.getByText(/valid image file/i)).toBeTruthy();
    fireEvent.change(remarksBox(), { target: { value: "Completed the task." } });
    expect(submitBtn().disabled).toBe(true);
  });

  it("enables Submit once a valid photo and non-empty remarks are both present", () => {
    mount();
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    fireEvent.change(remarksBox(), { target: { value: "Completed the task." } });
    expect(submitBtn().disabled).toBe(false);
  });

  it("submits photo + remarks together and shows success only after the save completes", async () => {
    const onSubmitted = vi.fn();
    mount(onSubmitted);
    const file = pngFile();
    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.change(remarksBox(), { target: { value: "Completed the task." } });

    fireEvent.click(submitBtn());

    await waitFor(() => expect(store.submit).toHaveBeenCalledTimes(1));
    expect(store.submit.mock.calls[0][0]).toBe("occ-1");
    expect(store.submit.mock.calls[0][1]).toEqual({ photo: file, remarks: "Completed the task." });

    await waitFor(() => expect(screen.getByText(/Submitted successfully/)).toBeTruthy());
    expect(onSubmitted).toHaveBeenCalledWith({ _id: "occ-1", status: "Completed" });
  });

  it("does not show success and surfaces the error when the save fails", async () => {
    store.submit.mockRejectedValueOnce(new Error("Network error"));
    mount();
    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
    fireEvent.change(remarksBox(), { target: { value: "Completed the task." } });
    fireEvent.click(submitBtn());

    await waitFor(() => expect(screen.getByText("Network error")).toBeTruthy());
    expect(screen.queryByText(/Submitted successfully/)).toBeNull();
  });

  it("allows replacing the selected photo before submit", () => {
    mount();
    const first = pngFile("first.png");
    const second = pngFile("second.png");
    fireEvent.change(fileInput(), { target: { files: [first] } });
    expect(screen.getByAltText(/preview/i)).toBeTruthy();
    fireEvent.change(fileInput(), { target: { files: [second] } });
    // Still exactly one preview image, now backed by the replacement file.
    expect(screen.getAllByAltText(/preview/i)).toHaveLength(1);
  });
});