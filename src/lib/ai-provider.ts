export type AIProviderId = "openai" | "anthropic";

export interface AIProviderResult {
  content: string;
  provider: AIProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIProviderOptions {
  provider?: AIProviderId;
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export function getAIProviderSelection(options: Pick<AIProviderOptions, "provider" | "model"> = {}) {
  const provider = options.provider ?? (process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai");
  const model = options.model ?? process.env.AI_MODEL ?? (provider === "openai" ? "gpt-4.1-mini" : "");
  return { provider, model };
}

function resolveProviderConfig(provider?: AIProviderId, model?: string) {
  const selectedProvider = provider ?? (process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai");
  const selectedModel = model ?? process.env.AI_MODEL ?? (selectedProvider === "openai" ? "gpt-4.1-mini" : "");
  const apiKey = selectedProvider === "openai"
    ? process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
    : process.env.ANTHROPIC_API_KEY;

  if (!selectedModel) throw new Error("AI_MODEL must be configured for the selected provider.");
  if (!apiKey) throw new Error(selectedProvider === "openai" ? "OPENAI_API_KEY is not configured." : "ANTHROPIC_API_KEY is not configured.");

  return { provider: selectedProvider, model: selectedModel, apiKey };
}

/**
 * Provider boundary for structured workflow planning. Provider responses are
 * treated as untrusted text and must be parsed and validated by the caller.
 */
export async function generateAICompletion(
  systemPrompt: string,
  userPrompt: string,
  options: AIProviderOptions = {},
): Promise<AIProviderResult> {
  const config = resolveProviderConfig(options.provider, options.model);
  const signal = AbortSignal.timeout(options.timeoutMs ?? 25_000);
  const maxOutputTokens = options.maxOutputTokens ?? 1_200;

  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        max_tokens: maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal,
    });
    if (!response.ok) throw new Error(`AI provider request failed with status ${response.status}.`);
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned an empty response.");
    return {
      content,
      provider: config.provider,
      model: config.model,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxOutputTokens,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`AI provider request failed with status ${response.status}.`);
  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content = payload.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
  if (!content) throw new Error("AI provider returned an empty response.");
  return {
    content,
    provider: config.provider,
    model: config.model,
    promptTokens: payload.usage?.input_tokens ?? 0,
    completionTokens: payload.usage?.output_tokens ?? 0,
  };
}
