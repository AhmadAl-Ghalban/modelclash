import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatCost, runPrompt, type ProviderResult } from "@modelclash/core";
import { loadSettings, selectProviders, PROVIDER_NAMES } from "../settings.js";

const providerEnum = z.enum(
  PROVIDER_NAMES as [(typeof PROVIDER_NAMES)[number], ...typeof PROVIDER_NAMES],
);

const inputSchema = {
  prompt: z.string().min(1).describe("The prompt to send to every provider"),
  providers: z
    .array(providerEnum)
    .optional()
    .describe(
      "Subset of providers to query. Defaults to every provider that has credentials configured.",
    ),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional()
    .describe("Prior conversation turns, oldest first"),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().positive().optional(),
};

export function registerCompareTool(server: McpServer): void {
  server.registerTool(
    "compare_models",
    {
      title: "Compare models",
      description:
        "Send one prompt to multiple LLM providers in parallel and return each response with token usage, estimated cost, and latency.",
      inputSchema,
    },
    async ({ prompt, providers, history, temperature, timeoutMs }) => {
      const session = await loadSettings();
      const { providers: selected, missing } = selectProviders(session, providers);

      if (selected.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: missing.length
                ? `No credentials configured for: ${missing.join(", ")}. Set the matching API key env var or run \`modelclash config\`.`
                : "No providers are configured. Set at least one API key (e.g. OPENAI_API_KEY) or run `modelclash config`.",
            },
          ],
        };
      }

      const results = await runPrompt({
        prompt,
        history,
        providers: selected,
        modelFor: session.models,
        temperature: temperature ?? session.temperature,
        timeoutMs: timeoutMs ?? session.timeoutMs,
      });

      return {
        content: [{ type: "text" as const, text: renderResults(results, missing) }],
        structuredContent: { results: results.map(toStructured) },
      };
    },
  );
}

function toStructured(result: ProviderResult) {
  return result.ok
    ? { ok: true as const, ...result.value }
    : { ok: false as const, ...result.error };
}

function renderResults(results: ProviderResult[], missing: string[]): string {
  const blocks = results.map((r) =>
    r.ok
      ? [
          `## ${r.value.provider} · ${r.value.model}`,
          r.value.text,
          `_${r.value.usage.total} tokens (${r.value.usage.input} in / ${r.value.usage.output} out) · ${formatCost(r.value.costUsd)} · ${r.value.durationMs}ms_`,
        ].join("\n\n")
      : `## ${r.error.provider} · ${r.error.model}\n\n**Failed:** ${r.error.message}`,
  );

  const ok = results.filter((r) => r.ok);
  if (ok.length > 1) {
    const totalCost = ok.reduce((sum, r) => sum + (r.ok ? r.value.costUsd : 0), 0);
    const fastest = ok.reduce((a, b) =>
      a.ok && b.ok && b.value.durationMs < a.value.durationMs ? b : a,
    );
    blocks.push(
      `---\n\n_Total ${formatCost(totalCost)} · fastest: ${fastest.ok ? fastest.value.provider : "n/a"}_`,
    );
  }
  if (missing.length) {
    blocks.unshift(`_Skipped (no credentials): ${missing.join(", ")}_`);
  }
  return blocks.join("\n\n");
}
