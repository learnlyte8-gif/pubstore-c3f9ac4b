import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const mocks = vi.hoisted(() => ({ roles: ["supplier", "admin"], getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: string) => { filters[key] = value; return query; },
        maybeSingle: async () => ({
          data: mocks.roles.includes(filters.role) ? { role: filters.role } : null,
          error: null,
        }),
      };
      return query;
    },
  },
}));

describe("admin role coexistence", () => {
  beforeEach(() => {
    mocks.roles = ["supplier", "admin"];
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "account" } } } });
    sessionStorage.clear();
  });
  afterEach(cleanup);

  it("retains admin access when the account also has supplier role", async () => {
    const { result } = renderHook(() => useIsAdmin());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isAdmin).toBe(true);
  });

  it("does not grant supplier accounts admin access from browser storage", async () => {
    mocks.roles = ["supplier"];
    sessionStorage.setItem("pubstore.isAdmin", JSON.stringify({ userId: "account", isAdmin: true }));
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current.isAdmin).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isAdmin).toBe(false);
  });
});