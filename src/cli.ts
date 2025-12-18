#!/usr/bin/env node
/**
 * botbrowser-mcp CLI
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createConnection } from './index';

(async () => {
  // 直接使用 @playwright/mcp 的 createConnection
  const server = await createConnection();
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
