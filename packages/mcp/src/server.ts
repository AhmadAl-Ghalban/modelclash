import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompareTool } from "./tools/compare.js";
import { registerProvidersTool } from "./tools/providers.js";
import { registerCostTool } from "./tools/cost.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "modelclash",
    version: "1.0.0",
  });

  registerCompareTool(server);
  registerProvidersTool(server);
  registerCostTool(server);

  return server;
}
