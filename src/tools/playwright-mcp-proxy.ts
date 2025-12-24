/**
 * Playwright MCP Dynamic Multi-Instance Proxy
 * 
 * This proxy wraps @playwright/mcp to support dynamic browser context switching.
 * 
 * Key Architecture Change:
 * - Standard @playwright/mcp caches the BrowserContext at initialization
 * - This proxy ensures every tool call uses the CURRENT active context
 * - Enables multiple browser instances with dynamic switching via switch_browser_instance
 */
import { BrowserContext } from 'playwright';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createRequire } from 'node:module';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Create a require function for loading CommonJS modules in ES modules
const require = createRequire(import.meta.url);

/**
 * Dynamic Browser Context Factory
 * 
 * Ensures Playwright MCP always gets the current active context,
 * not a cached one from initialization time.
 */
class DynamicBrowserContextFactory {
  name = 'dynamic-multi-instance';
  description = 'Dynamically provides the current active browser context for multi-instance support';
  
  private contextGetter: () => Promise<BrowserContext>;

  constructor(contextGetter: () => Promise<BrowserContext>) {
    this.contextGetter = contextGetter;
  }

  /**
   * Called by Playwright MCP Context class every time it needs a browser context
   * This is invoked via _ensureBrowserContext() which happens on every tool call
   */
  async createContext(): Promise<{ 
    browserContext: BrowserContext; 
    close: () => Promise<void> 
  }> {
    // Get the CURRENT active context
    const browserContext = await this.contextGetter();
    
    return {
      browserContext,
      // Don't close - lifecycle managed externally by PlaywrightManager
      close: async () => {
        // No-op: we manage context lifecycle in our manager
      }
    };
  }
}

export class PlaywrightMCPProxy {
  private mcpServer: Server | null = null;
  private backend: any = null; // BrowserServerBackend instance
  private contextGetter: () => Promise<BrowserContext>;
  private factory: DynamicBrowserContextFactory;
  private tools: Map<string, Tool> = new Map();

  constructor(contextGetter: () => Promise<BrowserContext>) {
    this.contextGetter = contextGetter;
    this.factory = new DynamicBrowserContextFactory(contextGetter);
  }

  /**
   * Initialize the MCP connection with our dynamic context factory
   * 
   * We directly use Playwright MCP's internal modules to inject our
   * custom factory, bypassing the createConnection() helper which
   * doesn't support dynamic context switching.
   */
  async initialize(): Promise<void> {
    try {
      // Use file paths to load internal modules (bypassing package exports restrictions)
      const playwrightMcpPath = require.resolve('@playwright/mcp');
      const playwrightMcpDir = playwrightMcpPath.substring(0, playwrightMcpPath.lastIndexOf('/'));
      
      const { BrowserServerBackend } = require(`${playwrightMcpDir}/node_modules/playwright/lib/mcp/browser/browserServerBackend`);
      const mcpServer = require(`${playwrightMcpDir}/node_modules/playwright/lib/mcp/sdk/server`);
      const packageJSON = require(`${playwrightMcpDir}/package.json`);
      
      // Create backend with our dynamic factory
      // Provide a minimal config matching Playwright MCP's defaultConfig structure
      const config = {
        browser: {
          browserName: 'chromium',
          launchOptions: {
            channel: 'chrome',
            headless: false,
            chromiumSandbox: true
          },
          contextOptions: {
            viewport: null
          }
        },
        console: {
          level: 'info'
        },
        network: {
          allowedOrigins: undefined,
          blockedOrigins: undefined
        },
        server: {},
        saveTrace: false,
        snapshot: {
          mode: 'incremental'
        },
        timeouts: {
          action: 5000,
          navigation: 60000
        }
      };
      
      this.backend = new BrowserServerBackend(
        config,
        this.factory
      );
      
      // Create the MCP server
      this.mcpServer = mcpServer.createServer(
        'Playwright',
        packageJSON.version,
        this.backend,
        false
      );

      // Load all available tools
      await this.loadTools();
      
      console.error('[PlaywrightMCPProxy] Initialized with dynamic multi-instance support');
    } catch (error) {
      console.error('[PlaywrightMCPProxy] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load all tool definitions from Playwright MCP
   */
  private async loadTools(): Promise<void> {
    if (!this.mcpServer) {
      throw new Error('MCP Server not initialized');
    }

    try {
      // Get the tools/list handler from the MCP server
      const handler = (this.mcpServer as any)['_requestHandlers'].get('tools/list');
      if (!handler) {
        throw new Error('tools/list handler not found in MCP server');
      }

      // Call the handler to get all tools
      const result = await handler({
        method: 'tools/list',
        params: {}
      }, {});

      // Store tools in our map
      if (result && result.tools) {
        for (const tool of result.tools) {
          this.tools.set(tool.name, tool);
        }
      }
    } catch (error) {
      console.error('Failed to load Playwright tools:', error);
      throw error;
    }
  }

  /**
   * Get all tool definitions for MCP protocol
   * 
   * Adds optional instance_id parameter to all browser tools,
   * allowing AI agents to directly specify which browser instance to operate on.
   */
  getToolDefinitions(): Record<string, any> {
    const handlers: Record<string, any> = {};
    
    for (const [name, tool] of this.tools) {
      // Clone the original inputSchema and add instance_id parameter
      const enhancedSchema = JSON.parse(JSON.stringify(tool.inputSchema || {}));
      
      if (!enhancedSchema.properties) {
        enhancedSchema.properties = {};
      }
      
      // Add instance_id parameter to all browser tools
      enhancedSchema.properties.instance_id = {
        type: 'number',
        description: 'Optional browser instance ID to operate on. If not specified, uses the currently active instance. Use list_browser_instances to see available instances.'
      };
      
      handlers[name] = {
        description: `${tool.description} (Supports multi-instance via instance_id parameter)`,
        inputSchema: enhancedSchema,
        handler: async (args: any) => {
          return await this.callTool(name, args);
        }
      };
    }
    
    return handlers;
  }

  /**
   * Call a Playwright MCP tool
   * 
   * If instance_id is provided in args, temporarily switches to that instance,
   * executes the tool, then restores the previous active instance.
   * This allows AI agents to specify which browser to operate on directly.
   */
  async callTool(name: string, args: any): Promise<any> {
    if (!this.mcpServer) {
      throw new Error('MCP Server not initialized');
    }

    if (!this.tools.has(name)) {
      throw new Error(`Unknown Playwright tool: ${name}`);
    }

    // Extract instance_id if provided
    const { instance_id, ...toolArgs } = args || {};
    let previousInstanceId: number | null = null;
    let needsRestore = false;

    try {
      // If instance_id is specified, temporarily switch to that instance
      if (instance_id !== undefined) {
        const { PlaywrightManager } = await import('../playwright/manager.js');
        const { manager } = await import('../index.js');
        
        if (manager) {
          // Save current active instance
          const instances = manager.listInstances();
          const currentActive = instances.find((i: any) => i.is_active);
          if (currentActive) {
            previousInstanceId = currentActive.id;
          }
          
          // Switch to specified instance
          if (previousInstanceId !== instance_id) {
            await manager.switchActive(instance_id);
            await this.resetContext();
            needsRestore = true;
          }
        }
      }

      // Get the tools/call handler
      const handler = (this.mcpServer as any)['_requestHandlers'].get('tools/call');
      if (!handler) {
        throw new Error('tools/call handler not found in MCP server');
      }

      // Call the tool with our arguments (without instance_id)
      const result = await handler({
        method: 'tools/call',
        params: {
          name,
          arguments: toolArgs
        }
      }, {});

      return result;
    } catch (error) {
      console.error(`Playwright tool '${name}' failed:`, error);
      throw error;
    } finally {
      // Restore previous active instance if we switched
      if (needsRestore && previousInstanceId !== null) {
        try {
          const { manager } = await import('../index.js');
          if (manager) {
            await manager.switchActive(previousInstanceId);
            await this.resetContext();
          }
        } catch (error) {
          console.error('Failed to restore previous instance:', error);
        }
      }
    }
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get list of all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Reset the browser context cache
   * 
   * This forces Playwright MCP's Context to clear its cached BrowserContext,
   * so the next tool call will fetch the current active context from our factory.
   * 
   * CRITICAL for multi-instance switching to work correctly.
   */
  async resetContext(): Promise<void> {
    if (!this.backend || !this.backend._context) {
      return;
    }

    try {
      // Directly clear the cached promise without closing pages
      // This is safer than calling closeBrowserContext() which closes pages
      this.backend._context._browserContextPromise = undefined;
      this.backend._context._tabs = [];
      this.backend._context._currentTab = undefined;
    } catch (error) {
      // Silently handle errors during context reset
    }
  }

  /**
   * Close/cleanup the proxy
   */
  async close(): Promise<void> {
    // Clean up if needed
    if (this.backend && this.backend._context) {
      await this.backend._context.dispose();
    }
    this.mcpServer = null;
    this.backend = null;
    this.tools.clear();
  }
}
