/**
 * Account management tools
 */
import { AccountRepository } from '../db/repositories/account.js';

const accountRepo = new AccountRepository();

export const accountTools = {
  add_account: {
    description: 'Add an account to a browser profile with flexible metadata storage',
    inputSchema: {
      type: 'object',
      properties: {
        profile_alias: { type: 'string', description: 'Browser profile alias' },
        username: { type: 'string', description: 'Account username or identifier' },
        metadata: { type: 'string', description: 'Account metadata (password, email, 2FA, etc.) in any format - key-value, JSON, or natural language' },
      },
      required: ['profile_alias', 'username'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const id = accountRepo.create(args);
        return {
          content: [{
            type: 'text',
            text: `Account "${args.username}" added successfully with ID: ${id}`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to add account: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  list_accounts: {
    description: 'List all accounts or accounts for a specific profile',
    inputSchema: {
      type: 'object',
      properties: {
        profile_alias: { type: 'string', description: 'Filter by browser profile alias (optional)' },
      },
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const accounts = args.profile_alias
          ? accountRepo.getByProfile(args.profile_alias)
          : accountRepo.getAll();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accounts, null, 2),
          }],
        };
      } catch (error) {
        throw new Error(`Failed to list accounts: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  find_account: {
    description: 'Find a specific account by username within a profile',
    inputSchema: {
      type: 'object',
      properties: {
        profile_alias: { type: 'string', description: 'Browser profile alias' },
        username: { type: 'string', description: 'Account username to search for' },
      },
      required: ['profile_alias', 'username'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const account = accountRepo.findByUsername(args.profile_alias, args.username);
        return {
          content: [{
            type: 'text',
            text: account ? JSON.stringify(account, null, 2) : 'Account not found',
          }],
        };
      } catch (error) {
        throw new Error(`Failed to find account: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  update_account: {
    description: 'Update account information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Account ID' },
        username: { type: 'string', description: 'New username' },
        metadata: { type: 'string', description: 'New metadata' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        const { id, ...updates } = args;
        accountRepo.update(id, updates);
        return {
          content: [{
            type: 'text',
            text: `Account ${id} updated successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to update account: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },

  delete_account: {
    description: 'Delete an account',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Account ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args: any) => {
      try {
        accountRepo.delete(args.id);
        return {
          content: [{
            type: 'text',
            text: `Account ${args.id} deleted successfully`,
          }],
        };
      } catch (error) {
        throw new Error(`Failed to delete account: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
};
