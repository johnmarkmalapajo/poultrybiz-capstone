// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Only the network layer is faked. The notification store, Sidebar, Breadcrumb,
// PageLayout, NotificationBell and the Notifications page are all REAL.
const db = vi.hoisted(() => ({ rows: [], list: vi.fn() }));

vi.mock("../src/api/notification", () => ({
  listNotifications: (...a) => { db.list(...a); return Promise.resolve({ notifications: db.rows.map((r) => ({ ...r })) }); },
  markNotificationRead: (id) => { const r = db.rows.find((x) => x.id === id); if (r) r.read = true; return Promise.resolve({}); },
  markAllNotificationsRead: () => { db.rows.forEach((r) => { r.read = true; }); return Promise.resolve({}); },
  deleteNotification: (id) => { db.rows = db.rows.filter((x) => x.id !== id); return Promise.resolve({}); },
}));
vi.mock("../src/api/auth", () => ({ logout: vi.fn() }));

import PageLayout from "../src/components/PageLayout.jsx";
import Notifications from "../src/pages/Notifications.jsx";
import Inventory from "../src/pages/Inventory.jsx";

const now = new Date().toISOString();
const n = (id, o) => ({ id, title: `T${id}`, description: `D${id}`, dateTime: now, read: false, type: "alert", category: "egg", roles: [], ...o });
const fixtures = () => [
  n("1", { category: "egg" }),                              // visible to both
  n("2", { category: "sales" }),                            // Owner only (Farmer category rule)
  n("3", { type: "reminder", category: "task" }),           // both
  n("4", { category: "feed", read: true }),                 // already read
  n("5", { type: "reminder", category: "users" }),          // Owner only (Farmer category rule)
  n("6", { category: "egg", roles: ["Owner"] }),           // Owner only (roles rule)
];

const setRole = (role) => localStorage.setItem("user", JSON.stringify({ name: "Tester", role }));
const badge = () => document.querySelector(".pb-bell-badge");
const bell = () => document.querySelector(".pb-bell");

const Page = () => (
  <PageLayout breadcrumbItems={[{ label: "RECORDS", path: "/records" }, { label: "MORTALITY RECORD" }]}>
    <div>page body</div>
  </PageLayout>
);
const renderAt = (path = "/records/mortality") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/records" element={<div>records home</div>} />
        <Route path="/records/mortality" element={<Page />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  db.rows = fixtures();
  db.list.mockClear();
  setRole("Owner");
});
afterEach(() => cleanup());

describe("Sidebar", () => {
  for (const [role, expected, absent] of [
    ["Owner", ["Dashboard", "Records", "Inventory", "Sales and Transactions", "Personnel and Visitors", "To Do", "Settings"], []],
    ["Farmer", ["Dashboard", "Records", "Inventory", "To Do", "Settings"], ["Sales and Transactions", "Personnel and Visitors"]],
  ]) {
    it(`${role}: no Notifications item; every other item (and its permission rules) is unchanged`, async () => {
      setRole(role);
      renderAt();
      const sidebar = document.querySelector(".sidebar");
      expect(sidebar).toBeTruthy();
      expect(within(sidebar).queryByText("Notifications")).toBeNull();
      expect(sidebar.querySelector('a[href="/notifications"]')).toBeNull();
      expect(sidebar.querySelector('img[alt="Notifications"]')).toBeNull();
      for (const label of expected) expect(within(sidebar).getByText(label)).toBeTruthy();
      for (const label of absent) expect(within(sidebar).queryByText(label)).toBeNull();
    });
  }

  it("makes no notification request of its own (the Bell is the only subscriber on the page)", async () => {
    renderAt();
    await waitFor(() => expect(db.list).toHaveBeenCalled());
    expect(db.list).toHaveBeenCalledTimes(1);
  });
});

describe("Bell placement", () => {
  it("sits in the same header row as the breadcrumb, to its right; the hamburger is its own sibling on the left", async () => {
    renderAt();
    const row = document.querySelector(".pb-header-row");
    expect(row).toBeTruthy();
    expect([...row.children].map((k) => k.className.split(" ")[0])).toEqual(["pb-hamburger", "pb-breadcrumb", "pb-bell"]);
    const crumb = row.querySelector(".pb-breadcrumb");
    expect(within(crumb).getByText("MORTALITY RECORD")).toBeTruthy();
    expect(within(crumb).getByText("RECORDS")).toBeTruthy();
    expect(crumb.querySelector(".pb-bell")).toBeNull(); // never inside the scrolling breadcrumb
    expect(bell().getAttribute("href")).toBe("/notifications");
  });

  it("hamburger still opens the sidebar drawer", async () => {
    renderAt();
    const ham = document.querySelector(".pb-hamburger");
    expect(ham.getAttribute("aria-label")).toBe("Open menu");
    expect(document.querySelector(".sidebar-open")).toBeNull();
    fireEvent.click(ham);
    await waitFor(() => expect(document.querySelector(".sidebar-open")).toBeTruthy());
  });

  it("breadcrumb links still navigate", async () => {
    renderAt();
    fireEvent.click(screen.getByText("RECORDS"));
    expect(await screen.findByText("records home")).toBeTruthy();
  });

  it("exactly one Bell per page, including pages that build their own shell (Inventory)", async () => {
    renderAt("/inventory");
    expect(document.querySelectorAll(".pb-bell").length).toBe(1);
    cleanup();
    renderAt("/notifications");
    expect(document.querySelectorAll(".pb-bell").length).toBe(1);
  });

  it("is a labelled, keyboard-reachable link", async () => {
    renderAt();
    await waitFor(() => expect(bell().getAttribute("aria-label")).toBe("Notifications (5)"));
    expect(bell().tagName).toBe("A");
    expect(bell().getAttribute("title")).toBe("Notifications");
  });
});

describe("Unread badge", () => {
  it("Owner sees the count of ALL unread notifications they may see (5)", async () => {
    renderAt();
    await waitFor(() => expect(badge()?.textContent).toBe("5"));
  });

  it("Farmer's count follows the same role rules as the Notifications page (2: no sales/users, no Owner-only)", async () => {
    setRole("Farmer");
    renderAt();
    await waitFor(() => expect(badge()?.textContent).toBe("2"));
  });

  it("badge is hidden when nothing is unread", async () => {
    db.rows = db.rows.map((r) => ({ ...r, read: true }));
    renderAt();
    await waitFor(() => expect(db.list).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(badge()).toBeNull();
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
  });

  it("caps very large counts at 99+", async () => {
    db.rows = Array.from({ length: 120 }, (_, i) => n(`x${i}`, { category: "egg" }));
    renderAt();
    await waitFor(() => expect(badge()?.textContent).toBe("99+"));
  });

  it("each notification is counted once (distinct ids, no double counting)", async () => {
    renderAt();
    await waitFor(() => expect(badge()?.textContent).toBe("5"));
    expect(db.list).toHaveBeenCalledTimes(1);
  });
});

describe("Bell opens the EXISTING Notifications module and stays in sync with it", () => {
  const openFromBell = async () => {
    renderAt();
    await waitFor(() => expect(badge()?.textContent).toBe("5"));
    fireEvent.click(bell());
    await screen.findByText("Mark all as read");
  };

  it("click -> existing /notifications page with its tabs, filters and rows; Bell marks itself active", async () => {
    await openFromBell();
    expect(screen.getByText("Alerts")).toBeTruthy();
    expect(screen.getByText("Reminders")).toBeTruthy();
    expect(screen.getByText("All categories")).toBeTruthy();
    expect(bell().getAttribute("aria-current")).toBe("page");
    expect(document.querySelectorAll(".pb-bell").length).toBe(1);
  });

  it("badge equals the page's own Alerts + Reminders unread tab counts (3 + 2)", async () => {
    await openFromBell();
    const counts = [...document.querySelectorAll(".nt-tab-count")].map((e) => Number(e.textContent));
    expect(counts).toEqual([3, 2]);
    expect(Number(badge().textContent)).toBe(counts[0] + counts[1]);
  });

  it("opening the page makes ONE notification request (Bell and page share the in-flight request)", async () => {
    renderAt("/notifications");
    await screen.findByText("Mark all as read");
    expect(db.list).toHaveBeenCalledTimes(1);
  });

  it("'Mark as read' on the page lowers the Bell badge immediately (5 -> 4)", async () => {
    await openFromBell();
    fireEvent.click(document.querySelector(".nt-icon-btn:not(.danger)"));
    await waitFor(() => expect(badge()?.textContent).toBe("4"));
  });

  it("'Mark all as read' (existing behaviour: clears everything) hides the badge", async () => {
    await openFromBell();
    fireEvent.click(screen.getByText("Mark all as read"));
    await waitFor(() => expect(badge()).toBeNull());
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
  });

  it("deleting an unread notification lowers the badge", async () => {
    await openFromBell();
    fireEvent.click(document.querySelector(".nt-icon-btn.danger"));
    await waitFor(() => expect(badge()?.textContent).toBe("4"));
  });

  it("Farmer opening the page sees only Farmer-visible rows and a matching badge (2)", async () => {
    setRole("Farmer");
    renderAt("/notifications");
    await screen.findByText("Mark all as read");
    await waitFor(() => expect(badge()?.textContent).toBe("2"));
    const counts = [...document.querySelectorAll(".nt-tab-count")].map((e) => Number(e.textContent));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(screen.queryByText("T2")).toBeNull();
    expect(screen.queryByText("T6")).toBeNull();
  });
});