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
