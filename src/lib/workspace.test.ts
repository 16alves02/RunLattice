import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, findFirst } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { member: { findFirst } } }));

import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

describe("workspace membership authorization", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
  });

  it("rejects requests without a valid session", async () => {
    getSession.mockResolvedValue(null);

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.response?.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects authenticated users until MFA is enabled", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-unprotected", twoFactorEnabled: false },
      session: { activeOrganizationId: "org-1" },
    });

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.response?.status).toBe(403);
    expect(result.response?.headers.get("content-type")).toContain("application/json");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects an active organization that the user does not belong to", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", twoFactorEnabled: true },
      session: { activeOrganizationId: "org-outside" },
    });
    findFirst.mockResolvedValue(null);

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.response?.status).toBe(403);
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", organizationId: "org-outside" },
      select: { organizationId: true, role: true },
    });
  });

  it("returns a workspace only after membership is verified", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    findFirst.mockResolvedValue({ organizationId: "org-1", role: "owner" });

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.context).toEqual({ userId: "user-1", organizationId: "org-1", role: "owner" });
    expect(result.response).toBeUndefined();
  });

  it("uses a verified membership when the session has no active organization", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-2", twoFactorEnabled: true },
      session: { activeOrganizationId: null },
    });
    findFirst.mockResolvedValue({ organizationId: "org-2", role: "member" });

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.context).toEqual({ userId: "user-2", organizationId: "org-2", role: "member" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-2" },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true, role: true },
    });
  });
});

describe("workspace workflow permissions", () => {
  it("allows owners and admins to manage workflows", () => {
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageWorkspace("owner,member")).toBe(true);
  });

  it("keeps regular members read-only", () => {
    expect(canManageWorkspace("member")).toBe(false);
    expect(canManageWorkspace("member,viewer")).toBe(false);
  });
});
