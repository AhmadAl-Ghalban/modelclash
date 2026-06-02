import type { ModelPricing } from "../types/index.js";

export const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { inputPerMTokens: 2.5, outputPerMTokens: 10.0 },
  "gpt-4o-mini": { inputPerMTokens: 0.15, outputPerMTokens: 0.6 },
  "gpt-4-turbo": { inputPerMTokens: 10.0, outputPerMTokens: 30.0 },
  "o1": { inputPerMTokens: 15.0, outputPerMTokens: 60.0 },
  "o1-mini": { inputPerMTokens: 3.0, outputPerMTokens: 12.0 },

  // Anthropic
  "claude-sonnet-4": { inputPerMTokens: 3.0, outputPerMTokens: 15.0 },
  "claude-opus-4": { inputPerMTokens: 15.0, outputPerMTokens: 75.0 },
  "claude-haiku-4": { inputPerMTokens: 0.8, outputPerMTokens: 4.0 },
  "claude-3-5-sonnet-latest": { inputPerMTokens: 3.0, outputPerMTokens: 15.0 },
  "claude-3-5-haiku-latest": { inputPerMTokens: 0.8, outputPerMTokens: 4.0 },

  // Google
  "gemini-2.5-pro": { inputPerMTokens: 1.25, outputPerMTokens: 10.0 },
  "gemini-2.5-flash": { inputPerMTokens: 0.075, outputPerMTokens: 0.3 },
  "gemini-1.5-pro": { inputPerMTokens: 1.25, outputPerMTokens: 5.0 },

  // Groq (per https://groq.com/pricing)
  "llama-3.3-70b-versatile": { inputPerMTokens: 0.59, outputPerMTokens: 0.79 },
  "llama-3.1-8b-instant": { inputPerMTokens: 0.05, outputPerMTokens: 0.08 },
  "llama-3.1-70b-versatile": { inputPerMTokens: 0.59, outputPerMTokens: 0.79 },
  "mixtral-8x7b-32768": { inputPerMTokens: 0.24, outputPerMTokens: 0.24 },
  "gemma2-9b-it": { inputPerMTokens: 0.2, outputPerMTokens: 0.2 },

  // DeepSeek
  "deepseek-chat": { inputPerMTokens: 0.27, outputPerMTokens: 1.1 },
  "deepseek-reasoner": { inputPerMTokens: 0.55, outputPerMTokens: 2.19 },

  // Ollama (local — no cost)
  "llama3.2": { inputPerMTokens: 0, outputPerMTokens: 0 },
  "llama3.1": { inputPerMTokens: 0, outputPerMTokens: 0 },
  "llama3": { inputPerMTokens: 0, outputPerMTokens: 0 },
  "qwen2.5": { inputPerMTokens: 0, outputPerMTokens: 0 },
  "mistral": { inputPerMTokens: 0, outputPerMTokens: 0 },
};

export const DEFAULT_PRICING: ModelPricing = {
  inputPerMTokens: 0,
  outputPerMTokens: 0,
};
