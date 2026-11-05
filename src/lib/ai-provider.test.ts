import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAICompletion, getAIProviderSelection } from "@/lib/ai-provider";

describe("AI provider abstraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normalizes OpenAI structured completion responses", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("AI_MODEL", "test-model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "{\"name\":\"Example\"}" } }],
      usage: { prompt_tokens: 20, completion_tokens: 8 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAICompletion("system", "user");

    expect(result).toEqual({
      content: "{\"name\":\"Example\"}",
      provider: "openai",
      model: "test-model",
      promptTokens: 20,
      completionTokens: 8,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("supports Anthropic messages without exposing its key to the client", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    vi.stubEnv("AI_MODEL", "test-claude-model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "{\"name\":\"Example\"}" }],
      usage: { input_tokens: 16, output_tokens: 7 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAICompletion("system", "user", { provider: "anthropic" });

    expect(result.provider).toBe("anthropic");
    expect(result.promptTokens).toBe(16);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-anthropic-key" }),
      }),
    );
  });

  it("reports provider configuration without exposing its key", () => {
    vi.stubEnv("OPENAI_API_KEY", "private-key");
    vi.stubEnv("AI_MODEL", "test-model");
    expect(getAIProviderSelection()).toEqual({ provider: "openai", model: "test-model", configured: true });
  });

  it("fails clearly when a provider key is missing", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    await expect(generateAICompletion("system", "user")).rejects.toThrow("OPENAI_API_KEY is not configured.");
  });
});
