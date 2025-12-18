/**
 * botbrowser-mcp 主入口
 */

import { createConnection as createPlaywrightConnection } from '@playwright/mcp';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { BrowserContext } from 'playwright';

interface BotBrowserConfig {
  botMode?: boolean;
  stealth?: boolean;
  customHeaders?: Record<string, string>;
  [key: string]: any;
}

/**
 * 创建增强的 MCP 连接
 */
export async function createConnection(
  userConfig: BotBrowserConfig = {},
  contextGetter?: any
): Promise<Server> {
  const config: any = { ...userConfig };
  
  // Bot mode 优化
  if (userConfig.botMode) {
    config.browser = config.browser || {};
    config.browser.launchOptions = config.browser.launchOptions || {};
    config.browser.launchOptions.args = [
      ...(config.browser.launchOptions.args || []),
      '--disable-blink-features=AutomationControlled',
    ];
  }
  
  // Stealth mode
  if (userConfig.stealth) {
    config.browser = config.browser || {};
    config.browser.launchOptions = config.browser.launchOptions || {};
    config.browser.launchOptions.args = [
      ...(config.browser.launchOptions.args || []),
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ];
    
    config.browser.contextOptions = config.browser.contextOptions || {};
    if (!config.browser.contextOptions.userAgent) {
      config.browser.contextOptions.userAgent = 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
  }
  
  // 自定义请求头
  if (userConfig.customHeaders) {
    config.browser = config.browser || {};
    config.browser.contextOptions = config.browser.contextOptions || {};
    config.browser.contextOptions.extraHTTPHeaders = {
      ...(config.browser.contextOptions.extraHTTPHeaders || {}),
      ...userConfig.customHeaders,
    };
  }
  
  return createPlaywrightConnection(config, contextGetter);
}
