import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('server starts and exposes List tools without cookies', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'amazon-startup-test-'))
  const client = new Client({ name: 'startup-check', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../build/index.js', import.meta.url).pathname],
    stderr: 'pipe',
    env: { ...process.env, AMAZON_COOKIES_FILE: join(directory, 'missing-cookies.json') },
  })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    for (const name of ['amazon_list_lists', 'amazon_list_items', 'amazon_add_to_list']) {
      assert.ok(tools.some(tool => tool.name === name), `${name} must be available`)
    }
  } finally {
    await client.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
