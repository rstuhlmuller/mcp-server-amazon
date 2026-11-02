import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('server starts and exposes List tools without cookies', {
  skip: existsSync(new URL('../amazonCookies.json', import.meta.url)),
}, async () => {
  const client = new Client({ name: 'startup-check', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../build/index.js', import.meta.url).pathname],
    stderr: 'pipe',
  })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    for (const name of ['amazon_list_lists', 'amazon_list_items', 'amazon_add_to_list']) {
      assert.ok(tools.some(tool => tool.name === name), `${name} must be available`)
    }
  } finally {
    await client.close()
  }
})
