import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock, test } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'amazon-login-test-'))
let closed = false
mock.module('puppeteer', { defaultExport: { launch: async () => ({
  newPage: async () => ({ goto: async url => assert.equal(new URL(url).hostname, 'www.amazon.com') }),
  cookies: async () => [
    { domain: '.amazon.com', name: 'at-main', value: 'synthetic-test-session' },
    { domain: '.unrelated.com', name: 'other', value: 'excluded' },
  ],
  close: async () => { closed = true },
}) } })

test('login saves only Amazon cookies with owner-only permissions and closes browser', async () => {
  const previous = process.env.AMAZON_COOKIES_FILE
  const cookiePath = join(directory, 'amazonCookies.json')
  process.env.AMAZON_COOKIES_FILE = cookiePath
  try {
    await import('../scripts/login.mjs')
    const saved = JSON.parse(readFileSync(cookiePath, 'utf8'))
    assert.equal(saved.length, 1)
    assert.equal(saved[0].name, 'at-main')
    assert.equal(statSync(cookiePath).mode & 0o777, 0o600)
    assert.equal(closed, true)
  } finally {
    if (previous === undefined) delete process.env.AMAZON_COOKIES_FILE
    else process.env.AMAZON_COOKIES_FILE = previous
    rmSync(directory, { recursive: true, force: true })
  }
})
