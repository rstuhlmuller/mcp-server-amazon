import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = process.env.PLUGIN_TEST_ROOT || fileURLToPath(new URL('../dist/amazon-marketplace/plugins/amazon-local', import.meta.url))

test('packaged plugin starts and exposes List tools without bundled account data', async () => {
  assert.deepEqual(readdirSync(root).sort(), ['LICENSE', 'build', 'mcp.json', 'mocks', 'node_modules', 'package.json', 'plugin.json'])
  assert.deepEqual(readdirSync(`${root}/mocks`), [])
  assert.equal(existsSync(`${root}/amazonCookies.json`), false)
  const manifest = JSON.parse(readFileSync(`${root}/plugin.json`, 'utf8'))
  assert.equal(manifest.extensions['com.openai'].requires_local_executor, true)
  const server = JSON.parse(readFileSync(`${root}/mcp.json`, 'utf8')).mcpServers.amazon
  const client = new Client({ name: 'plugin-check', version: '1.0.0' })
  try {
    await client.connect(new StdioClientTransport({
      command: server.command,
      args: server.args.map(arg => arg.replaceAll('${PLUGIN_ROOT}', root)),
      cwd: root,
      env: { ...process.env, ...server.env, AMAZON_COOKIES_FILE: `${root}/missing-cookies.json` },
      stderr: 'pipe',
    }))
    const { tools } = await client.listTools()
    for (const name of ['amazon_list_lists', 'amazon_list_items', 'amazon_add_to_list']) {
      assert.ok(tools.some(tool => tool.name === name), name)
    }
    for (const [name, args] of [
      ['amazon_list_lists', {}],
      ['amazon_list_items', { listId: 'ABC123' }],
      ['amazon_add_to_list', { listId: 'ABC123', asin: 'B012345678' }],
    ]) {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 2000 })
      assert.equal(result.isError, true)
      assert.match(result.content[0].text, /Amazon login required/)
    }
  } finally {
    await client.close()
  }
})
