import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, deleteMany, getRequestWorkspace, canManageWorkspace, syncWorkflowSchedule } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  getRequestWorkspace: vi.fn(),
  canManageWorkspace: vi.fn(),
  syncWorkflowSchedule: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { workflow: { findFirst, deleteMany } },
}));
vi.mock("@/lib/workspace", () => ({
  getRequestWorkspace,
  canManageWorkspace,
}));
vi.mock("@/lib/schedule", () => ({
  syncWorkflowSchedule,
}));

import { DELETE } from "@/app/api/workflows/[id]/route";

describe("DELETE /api/workflows/[id]", () => {
  beforeEach(() => {
    findFirst.mockReset();
    deleteMany.mockReset();
    getRequestWorkspace.mockReset();
    canManageWorkspace.mockReset();
    syncWorkflowSchedule.mockReset();

    getRequestWorkspace.mockResolvedValue({
      context: { userId: "user-owner", organizationId: "workspace-owner", role: "owner" },
    });
    canManageWorkspace.mockReturnValue(true);
    syncWorkflowSchedule.mockResolvedValue(true);
    deleteMany.mockResolvedValue({ count: 1 });
  });

  it("does not touch the shared scheduler for a workflow outside the workspace", async () => {
    findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/workflows/workflow-from-another-workspace", { method: "DELETE" }),
      { params: Promise.resolve({ id: "workflow-from-another-workspace" }) },
    );

    expect(response.status).toBe(404);
    expect(syncWorkflowSchedule).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("removes a scheduler only after verifying workspace ownership", async () => {
    findFirst.mockResolvedValue({ id: "workflow-owned" });

    const response = await DELETE(
      new Request("http://localhost/api/workflows/workflow-owned", { method: "DELETE" }),
      { params: Promise.resolve({ id: "workflow-owned" }) },
    );

    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "workflow-owned", organizationId: "workspace-owner" },
      select: { id: true },
    });
    expect(syncWorkflowSchedule).toHaveBeenCalledOnce();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "workflow-owned", organizationId: "workspace-owner" },
    });
  });
});
