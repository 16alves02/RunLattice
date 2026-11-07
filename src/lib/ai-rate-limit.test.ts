import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeAIRequestRateLimit } from "@/lib/ai-rate-limit";

describe("AI request rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("applies both user and workspace fixed-window limits", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }]);
    const database = { $queryRawUnsafe: query };

    const result = await consumeAIRequestRateLimit(database, {
      organizationId: "workspace-secret",
      userId: "user-secret",
      now: 1_800_000_000_000,
    });

    expect(result).toEqual({ allowed: true });
    expect(query).toHaveBeenCalledTimes(2);
    const firstKey = query.mock.calls[0][2] as string;
    const secondKey = query.mock.calls[1][2] as string;
    expect(firstKey).toMatch(/^runlattice:ai:user:/);
    expect(secondKey).toMatch(/^runlattice:ai:workspace:/);
    expect(firstKey).not.toContain("workspace-secret");
    expect(firstKey).not.toContain("user-secret");
  });

  it("blocks a user after the configured per-minute limit", async () => {
    vi.stubEnv("AI_RATE_LIMIT_PER_USER", "2");
    const query = vi.fn().mockResolvedValue([{ count: 3 }]);
    const result = await consumeAIRequestRateLimit(
      { $queryRawUnsafe: query },
      { organizationId: "workspace-1", userId: "user-1", now: 1_800_000_000_000 },
    );

    expect(result).toEqual({ allowed: false, scope: "user", limit: 2 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("blocks a workspace after the configured shared limit", async () => {
    vi.stubEnv("AI_RATE_LIMIT_PER_WORKSPACE", "4");
    const query = vi.fn()
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 5 }]);
    const result = await consumeAIRequestRateLimit(
      { $queryRawUnsafe: query },
      { organizationId: "workspace-1", userId: "user-1", now: 1_800_000_000_000 },
    );

    expect(result).toEqual({ allowed: false, scope: "workspace", limit: 4 });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("resets an expired window atomically in PostgreSQL", async () => {
    const query = vi.fn().mockResolvedValue([{ count: 1 }]);
    await consumeAIRequestRateLimit(
      { $queryRawUnsafe: query },
      { organizationId: "workspace-1", userId: "user-1", now: 1_800_000_000_000 },
    );

    expect(query.mock.calls[0][0]).toContain('WHEN "RateLimit"."lastRequest" <= $4 THEN 1');
    expect(query.mock.calls[0][3]).toBe(BigInt(1_800_000_000_000));
    expect(query.mock.calls[0][4]).toBe(BigInt(1_799_999_940_000));
  });
});
