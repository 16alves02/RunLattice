import { describe, expect, it, vi } from "vitest";
import { admitRunUnderQuota } from "@/lib/run-quota";

describe("workspace monthly execution quota", () => {
  it("admits the final available execution", async () => {
    const create = vi.fn().mockResolvedValue({ id: "run-100" });
    const result = await admitRunUnderQuota(99, 100, create);

    expect(result).toEqual({ allowed: true, data: { id: "run-100" }, used: 100, limit: 100 });
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects an execution once the monthly limit is reached", async () => {
    const create = vi.fn().mockResolvedValue({ id: "must-not-be-created" });
    const result = await admitRunUnderQuota(100, 100, create);

    expect(result).toEqual({ allowed: false, used: 100, limit: 100 });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not increment usage when run creation fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(admitRunUnderQuota(99, 100, create)).rejects.toThrow("database unavailable");
    expect(create).toHaveBeenCalledOnce();
  });
});
