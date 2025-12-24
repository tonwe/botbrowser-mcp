/**
 * 浏览器配置管理工具
 */
import { ProfileRepository, BrowserProfile } from '../db/repositories/profile.js';

const profileRepo = new ProfileRepository();

export const profileTools = {
  list_browser_profiles: {
    description: 'List all browser profiles with their configurations',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      try {
        const profiles = profileRepo.getAll();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(profiles, null, 2),
          }],
        };
      } catch (error) {
        throw new Error(`Failed to list profiles: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  create_browser_profile: {
    description: 'Create a new browser profile with executable path and optional proxy settings',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'Unique profile identifier' },
        executable_path: { type: 'string', description: 'Path to Chrome/Chromium executable' },
        fingerprint_path: { type: 'string', description: 'Path to fingerprint configuration file (optional)' },
        storage_state_path: { type: 'string', description: 'Path to save cookies/localStorage (optional)' },
        description: { type: 'string', description: 'Profile description' },
        proxy_server: { type: 'string', description: 'Proxy server URL (e.g., http://127.0.0.1:7890)' },
        proxy_username: { type: 'string', description: 'Proxy authentication username' },
        proxy_password: { type: 'string', description: 'Proxy authentication password' },
        proxy_bypass: { type: 'string', description: 'Comma-separated domains to bypass proxy' },
      },
      required: ['alias', 'executable_path'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        profileRepo.create(args);
        return {
          content: [{
            type: 'text',
            text: `Profile "${args.alias}" created successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to create profile: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  update_browser_profile: {
    description: 'Update an existing browser profile configuration',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'Profile alias to update' },
        executable_path: { type: 'string', description: 'New executable path' },
        fingerprint_path: { type: 'string', description: 'New fingerprint path' },
        storage_state_path: { type: 'string', description: 'New storage state path' },
        description: { type: 'string', description: 'New description' },
        proxy_server: { type: 'string', description: 'New proxy server URL' },
        proxy_username: { type: 'string', description: 'New proxy username' },
        proxy_password: { type: 'string', description: 'New proxy password' },
        proxy_bypass: { type: 'string', description: 'New proxy bypass list' },
      },
      required: ['alias'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const { alias, ...updates } = args;
        profileRepo.update(alias, updates);
        return {
          content: [{
            type: 'text',
            text: `Profile "${alias}" updated successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to update profile: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  delete_browser_profile: {
    description: 'Delete a browser profile and all associated accounts',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'Profile alias to delete' },
      },
      required: ['alias'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        profileRepo.delete(args.alias);
        return {
          content: [{
            type: 'text',
            text: `Profile "${args.alias}" deleted successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
};
