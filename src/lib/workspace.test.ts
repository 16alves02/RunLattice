import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, findFirst } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession } },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { member: { findFirst } },
}));

import { getRequestWorkspace } from "@/lib/workspace";

describe("workspace request authorization", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
  });

  it("rejects requests without an authenticated session", async () => {
    getSession.mockResolvedValue(null);

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.response?.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects a session whose active organization is not a member workspace", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-outside" },
    });
    findFirst.mockResolvedValue(null);

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.response?.status).toBe(403);
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", organizationId: "org-outside" },
      select: { organizationId: true },
    });
  });

  it("returns the active organization only after membership is verified", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    findFirst.mockResolvedValue({ organizationId: "org-1" });

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.context).toEqual({ userId: "user-1", organizationId: "org-1" });
    expect(result.response).toBeUndefined();
  });

  it("selects a verified membership when no active organization is set", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-2" },
      session: { activeOrganizationId: null },
    });
    findFirst.mockResolvedValue({ organizationId: "org-2" });

    const result = await getRequestWorkspace(new Request("http://localhost/api/workflows"));

    expect(result.context).toEqual({ userId: "user-2", organizationId: "org-2" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-2" },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
  });
});
