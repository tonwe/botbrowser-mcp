#!/usr/bin/env node

/**
 * BotBrowser-MCP Server 主入口
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initDatabase } from './db/database.js';
import { PlaywrightManager } from './playwright/manager.js';
import { profileTools } from './tools/profile.js';
import { accountTools } from './tools/account.js';
import { instanceTools, setManager as setInstanceManager } from './tools/instance.js';
import { PlaywrightMCPProxy } from './tools/playwright-mcp-proxy.js';

// 初始化数据库
initDatabase();

// 创建 Playwright 管理器并导出（供 playwright-mcp-proxy 访问）
export const manager = new PlaywrightManager();
setInstanceManager(manager);

// 创建 Playwright MCP 代理并导出为全局变量（供 switch_browser_instance 使用）
export const playwrightMCPProxy = new PlaywrightMCPProxy(async () => {
  const context = manager.getActiveContext();
  if (!context) {
    throw new Error('没有活跃的浏览器实例，请先使用 launch_instance 启动');
  }
  return context;
});

// 初始化工具
let allTools: Record<string, any> = {};

async function initializeTools() {
  // 初始化 Playwright MCP 代理
  await playwrightMCPProxy.initialize();
  
  // 获取 Playwright MCP 的所有工具
  const playwrightTools = playwrightMCPProxy.getToolDefinitions();
  
  // 合并所有工具
  allTools = {
    ...profileTools,
    ...accountTools,
    ...instanceTools,
    ...playwrightTools, // 完整的 Playwright MCP 工具集
  };
}

// 创建 MCP Server
const server = new Server(
  {
    name: 'botbrowser-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表处理
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(allTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// 注册工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = allTools[toolName as keyof typeof allTools];

  if (!tool) {
    throw new Error(`未知工具: ${toolName}`);
  }

  try {
    return await tool.handler(request.params.arguments || {});
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `错误: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  // 初始化所有工具
  await initializeTools();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 优雅退出
  process.on('SIGINT', async () => {
    await playwrightMCPProxy.close();
    await manager.stopAll();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await playwrightMCPProxy.close();
    await manager.stopAll();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

