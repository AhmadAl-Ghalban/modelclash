import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const PROVIDER_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "DEEPSEEK_API_KEY",
  "OLLAMA_BASE_URL",
  "OLLAMA_ENABLED",
];

async function connect() {
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    createServer().connect(serverTransport),
  ]);
  return client;
}

describe("modelclash MCP server", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Isolate from the developer's real keys and ~/.modelclash/config.json.
    for (const key of PROVIDER_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    saved.MODELCLASH_CONFIG = process.env.MODELCLASH_CONFIG;
    process.env.MODELCLASH_CONFIG = "/nonexistent/modelclash-test.json";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("exposes the three modelclash tools", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "compare_models",
      "estimate_cost",
      "list_providers",
    ]);
  });

  it("reports every provider as unconfigured when no keys are set", async () => {
    const result = await (await connect()).callTool({
      name: "list_providers",
      arguments: {},
    });
    const providers = (result.structuredContent as any).providers;
    expect(providers).toHaveLength(6);
    expect(providers.every((p: any) => p.configured === false)).toBe(true);
    expect(providers.find((p: any) => p.provider === "openai").model).toBe(
      "gpt-4o",
    );
  });

  it("estimates cost from the pricing table", async () => {
    const result = await (await connect()).callTool({
      name: "estimate_cost",
      arguments: { model: "gpt-4o", inputTokens: 1000, outputTokens: 500 },
    });
    const structured = result.structuredContent as any;
    expect(structured.pricingKnown).toBe(true);
    expect(structured.usage.total).toBe(1500);
    expect(structured.costUsd).toBeGreaterThan(0);
  });

  it("returns a tool error instead of calling out when nothing is configured", async () => {
    const result = await (await connect()).callTool({
      name: "compare_models",
      arguments: { prompt: "hello" },
    });
    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toMatch(/No providers are configured/);
  });

  it("rejects an unknown provider name", async () => {
    const result = await (await connect()).callTool({
      name: "compare_models",
      arguments: { prompt: "hello", providers: ["not-a-provider"] },
    });
    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toMatch(/Invalid enum value/);
  });
});
