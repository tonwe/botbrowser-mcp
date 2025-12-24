/**
 * Browser instance management tools
 */
import { PlaywrightManager } from '../playwright/manager.js';

let manager: PlaywrightManager;

export function setManager(m: PlaywrightManager) {
  manager = m;
}

export const instanceTools = {
  launch_browser: {
    description: 'Launch a new browser instance based on a profile configuration',
    inputSchema: {
      type: 'object',
      properties: {
        profile_alias: { type: 'string', description: 'Browser profile alias to use' },
        account_id: { type: 'number', description: 'Optional account ID to associate with this instance' },
        launch_options: { 
          type: 'object', 
          description: 'Optional Playwright launch options (e.g., {"headless": false, "channel": "chrome"})',
          additionalProperties: true,
        },
      },
      required: ['profile_alias'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const id = await manager.launchInstance(args.profile_alias, args.account_id, args.launch_options);
        return {
          content: [{
            type: 'text',
            text: `Browser instance ${id} launched successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  list_browser_instances: {
    description: 'List all running browser instances with their status',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      try {
        const instances = manager.listInstances();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(instances, null, 2),
          }],
        };
      } catch (error) {
        throw new Error(`Failed to list instances: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  switch_browser_instance: {
    description: 'Switch the active browser instance. All subsequent browser operations will run on the switched instance',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: { type: 'number', description: 'Instance ID to switch to' },
      },
      required: ['instance_id'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        await manager.switchActive(args.instance_id);
        
        // CRITICAL: Reset Playwright MCP's context cache
        // This forces it to fetch the new active context on the next tool call
        const { playwrightMCPProxy } = await import('../index.js');
        if (playwrightMCPProxy) {
          await playwrightMCPProxy.resetContext();
        }
        
        return {
          content: [{
            type: 'text',
            text: `Switched to instance ${args.instance_id}`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to switch instance: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  stop_browser_instance: {
    description: 'Stop a running browser instance and save its state',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: { type: 'number', description: 'Instance ID to stop' },
      },
      required: ['instance_id'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        await manager.stopInstance(args.instance_id);
        return {
          content: [{
            type: 'text',
            text: `Instance ${args.instance_id} stopped successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to stop instance: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  cleanup_orphaned_instances: {
    description: 'Clean up orphaned instance records (database entries for instances that are no longer running)',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      try {
        const count = await manager.cleanupOrphaned();
        return {
          content: [{
            type: 'text',
            text: `Cleaned up ${count} orphaned instance record(s)`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to cleanup orphaned instances: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
};
