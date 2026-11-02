# Amazon MCP Server

This server allows you to interact with Amazon's services using the MCP (Model Context Protocol) framework. This lets you use your Amazon account through ChatGPT or Claude AI interfaces.

## Features

- **Product search**: Search for products on Amazon
- **Product details**: Retrieve detailed information about a specific product on Amazon
- **Cart management**: Add items or clear your Amazon cart
- **Ordering**: Place orders (fake for demonstration purposes)
- **Orders history**: Retrieve your recent Amazon orders details

## Demo

Simple demo, showcasing a quick product search and purchase.

![Demo GIF video](./demo.gif)

## Full Demo

Another more complex demo with products search, leveraging Claude AI recommendations to compare and make a decision, then purchase.

It showcases how natural and powerful the Amazon MCP integration could be inside a conversation

Video: https://www.youtube.com/watch?v=xas2CLkJDYg

## Install

Install dependencies

```sh
npm install -D
```

Build the project

```sh
npm run build
```

## Claude Desktop Integration

Create or update `~/Library/Application Support/Claude/claude_desktop_config.json` with the path to the MCP server.

```json
{
  "mcpServers": {
    "amazon": {
      "command": "node",
      "args": ["/Users/admin/dev/mcp-server-amazon/build/index.js"]
    }
  }
}
```

Restart the Claude Desktop app to apply the changes. You should now see the Amazon MCP server listed in the Claude Desktop app.

|                                  |                                    |
| :------------------------------: | :--------------------------------: |
| ![screenshot](./screenshot.webp) | ![screenshot2](./screenshot2.webp) |

## Troubleshooting

The MCP server logs its output to a file. If you encounter any issues, you can check the log file for more information.

See `~/Library/Logs/Claude/mcp-server-amazon.log`

## License

[The MIT license](./LICENSE)

## Amazon Lists

| Tool | Arguments | Result |
| --- | --- | --- |
| `amazon_list_lists` | None | Named Lists with `listId`, `name`, and `url` |
| `amazon_list_items` | `listId` | Products with ASIN, title, product URL, optional price/image, and `complete` |
| `amazon_add_to_list` | `listId`, `asin` | Verified addition to the selected List |

Use a `listId` from `amazon_list_lists`. These tools reuse the configured Amazon cookies and marketplace. Reading items loads up to 50 batches; `complete: false` means more items may exist. Failed access or an unverified addition returns an MCP error. Mock mode supports reading the synthetic List fixtures and disables additions.

Run the offline List checks with `npm run test:lists`.

### Local ChatGPT Work setup

Register the built server with `codex mcp add amazon -- /absolute/path/to/node /absolute/path/to/mcp-server-amazon/build/index.js`, then restart the MCP server in the desktop app. The server starts and advertises its tools without `amazonCookies.json`; authenticated Amazon operations still need an Amazon browser session. Standard Login with Amazon OAuth profile scopes do not grant access to shopping Lists or the cart.

Verify cookie-free startup with `npm run build && node --test tests/startup.test.mjs`.

### Amazon Local plugin (desktop)

Package and install this version as a local plugin:

```sh
npm run package:plugin
codex plugin marketplace add "$PWD/dist/amazon-marketplace"
codex plugin add amazon-local@amazon-local-marketplace
```

Start a new local Work chat and select **Amazon Local** from Plugins. This is a desktop-only local plugin, not a published web plugin. Node.js and the Puppeteer browser must be installed on the machine. The generated package records this machine's Node executable and cookie-file path; rebuild it on another machine.

The package contains the built server and installed dependencies, with no cookies or captured Amazon pages. It reads `amazonCookies.json` from the original checkout through `AMAZON_COOKIES_FILE`; the environment variable also works for standalone installations. Account operations still require authentication. Keep `dist/amazon-marketplace` for marketplace refreshes. After changing server code, rebuild the package and rerun `codex plugin add amazon-local@amazon-local-marketplace` to refresh the installed copy.

If migrating from the standalone registration, remove it after verifying the plugin with `codex mcp remove amazon` to avoid duplicate tools. Run `npm run test:plugin` to check the package contents and its MCP handshake.

### Sign in to Amazon

Run `npm run login` from this checkout. A dedicated browser opens Amazon.com; enter your credentials and any verification directly there. The helper waits up to 10 minutes, saves only Amazon cookies to `amazonCookies.json` with owner-only permissions, then closes the browser. The cookies and temporary login file are ignored by Git and excluded from the plugin package. The running plugin loads the saved session on its next request; no restart is needed after login. Ask it to list your Lists.

Run `node --experimental-test-module-mocks --test tests/login.test.mjs` to verify session-file filtering and permissions without using real credentials.
