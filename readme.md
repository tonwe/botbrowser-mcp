# botbrowser-mcp

A wrapper around [@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp).

## Installation

```bash
npm install -g botbrowser-mcp
```

## Usage

Add to your MCP client configuration (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "botbrowser": {
      "command": "botbrowser-mcp"
    }
  }
}
```

Or use with npx (no installation needed):

```json
{
  "mcpServers": {
    "botbrowser": {
      "command": "npx",
      "args": ["-y", "botbrowser-mcp"]
    }
  }
}
```

## Troubleshooting

If you get "Connection closed" error:
1. Make sure you're using the latest version: `npm install -g botbrowser-mcp@latest`
2. Try with full path: `"command": "/usr/local/bin/botbrowser-mcp"`
3. Check Node.js is installed: `node --version`

## License

Apache-2.0

