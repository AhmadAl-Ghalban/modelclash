import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadSettings, PROVIDER_NAMES } from "../settings.js";

export function registerProvidersTool(server: McpServer): void {
  server.registerTool(
    "list_providers",
    {
      title: "List providers",
      description:
        "List every modelclash provider, whether it has credentials configured, and the model that would be used for it.",
    },
    async () => {
      const session = await loadSettings();
      const rows = PROVIDER_NAMES.map((name) => ({
        provider: name,
        configured: session.configured.includes(name),
        model: session.models[name],
      }));

      const text = [
        ...rows.map(
          (r) => `${r.configured ? "✔" : "✖"} ${r.provider} → ${r.model}`,
        ),
        "",
        `Defaults: temperature ${session.temperature}, timeout ${session.timeoutMs}ms`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          providers: rows,
          temperature: session.temperature,
          timeoutMs: session.timeoutMs,
        },
      };
    },
  );
}
