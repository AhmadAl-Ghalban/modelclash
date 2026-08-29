#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// stdout is the MCP transport — anything written there that is not a protocol
// message corrupts the stream, so diagnostics must go to stderr.
async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  process.stderr.write("modelclash MCP server ready on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`modelclash MCP server failed: ${(err as Error).message}\n`);
  process.exit(1);
});
