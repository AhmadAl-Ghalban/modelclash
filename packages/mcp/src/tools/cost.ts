import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { estimateCost, formatCost, PRICING } from "@modelclash/core";

const inputSchema = {
  model: z.string().min(1).describe("Model id, e.g. gpt-4o or claude-sonnet-4"),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
};

export function registerCostTool(server: McpServer): void {
  server.registerTool(
    "estimate_cost",
    {
      title: "Estimate cost",
      description:
        "Estimate the USD cost of a request for a given model and token counts, using modelclash's pricing table.",
      inputSchema,
    },
    async ({ model, inputTokens, outputTokens }) => {
      const usage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };
      const costUsd = estimateCost(model, usage);
      const known = model in PRICING;

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${model}: ${formatCost(costUsd)} for ${usage.total} tokens ` +
              `(${inputTokens} in / ${outputTokens} out)` +
              (known ? "" : " — model not in pricing table, using fallback rates"),
          },
        ],
        structuredContent: { model, usage, costUsd, pricingKnown: known },
      };
    },
  );
}
