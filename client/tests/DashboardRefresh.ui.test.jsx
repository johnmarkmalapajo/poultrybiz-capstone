// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ summary: vi.fn() }));

vi.mock("../src/api/dashboard", () => ({ getDashboardSummary: (...a) => api.summary(...a) }));
vi.mock("../src/api/healthRecord", () => ({ listHealthRecords: () => Promise.resolve({ records: [] }) }));
vi.mock("../src/api/eggRecord", () => ({ listEggRecords: () => Promise.resolve({ records: [] }) }));
vi.mock("../src/api/flockProfile", () => ({ listFlocks: () => Promise.resolve({ flocks: [] }) }));
vi.mock("../src/api/notification", () => ({
  listNotifications: () => Promise.resolve({ notifications: [] }),
  markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(), deleteNotification: vi.fn(),
}));
vi.mock("../src/api/auth", () => ({ logout: vi.fn() }));
vi.mock("../src/todoStore", () => ({
  refreshPersonalTodos: () => Promise.resolve([]),
  getCachedPersonalTodos: () => [],
  updatePersonalTodoById: vi.fn(),
  getCurrentUser: () => ({ userId: "u1" }),
  subscribe: () => () => {},
}));
vi.mock("recharts", () => {
  const Stub = ({ children }) => <div>{children}</div>;
  return { PieChart: Stub, Pie: Stub, Cell: Stub, Tooltip: Stub, LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, ResponsiveContainer: Stub };
});

import Dashboard from "../src/pages/Dashboard.jsx";

const mount = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ name: "Tester", role: "Owner" }));
  api.summary.mockReset().mockImplementation(() => Promise.resolve({ data: { flock: { currentFlockSize: 321 } } }));
});
afterEach(() => cleanup());

describe("Dashboard without the Refresh button", () => {
  it("has no Refresh button anywhere", async () => {
    mount();
    await waitFor(() => expect(api.summary).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
    expect(screen.queryByText("Refresh")).toBeNull();
  });

  it("still loads the data automatically on open (1 request) and shows it", async () => {
    mount();
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("321")).toBeTruthy();
  });

  it("still reloads automatically on window focus and on pb_data_changed", async () => {
    mount();
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(2));
    await act(async () => { window.dispatchEvent(new Event("pb_data_changed")); });
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(3));
  });

  it("still shows the 'Loading dashboard...' indicator while loading, inside the greeting header, and hides it afterwards", async () => {
    let release;
    api.summary.mockImplementation(() => new Promise((r) => { release = () => r({ data: {} }); }));
    mount();
    const pill = await screen.findByText("Loading dashboard...");
    expect(pill.closest(".dash-header")).toBeTruthy();
    await act(async () => { release(); });
    await waitFor(() => expect(screen.queryByText("Loading dashboard...")).toBeNull());
  });

  it("still shows the error message when the load fails", async () => {
    api.summary.mockRejectedValue(new Error("Server down"));
    mount();
    expect(await screen.findByText("Server down")).toBeTruthy();
  });

  it("greeting header, KPI cards and the header Bell are still there", async () => {
    mount();
    expect(await screen.findByText(/Welcome/)).toBeTruthy();
    expect(document.querySelector(".cards")).toBeTruthy();
    expect(document.querySelectorAll(".pb-bell").length).toBe(1);
  });
});