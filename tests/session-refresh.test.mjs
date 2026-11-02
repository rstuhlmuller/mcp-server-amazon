import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock, test } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'amazon-session-test-'))
const cookiePath = join(directory, 'amazonCookies.json')
const previous = process.env.AMAZON_COOKIES_FILE
process.env.AMAZON_COOKIES_FILE = cookiePath
const save = (value, domain) => writeFileSync(cookiePath, JSON.stringify([
  { name: 'at-main', value, domain, path: '/', secure: true, httpOnly: true },
]), { mode: 0o600 })
save('initial-synthetic-session', '.amazon.com')
let appliedCookies = []
let launches = 0
mock.module('puppeteer', { defaultExport: { launch: async () => {
  launches++
  return {
    setCookie: async (...cookies) => { appliedCookies = cookies },
    newPage: async () => ({ evaluateOnNewDocument: async () => {}, setUserAgent: async () => {}, setViewport: async () => {} }),
    close: async () => {},
  }
} } })
const { createBrowserAndPage } = await import('../build/utils.js')
const { getAmazonDomain } = await import('../build/config.js')

test('running server picks up login changes and removal without reimport or restart', async () => {
  try {
    await createBrowserAndPage(true)
    assert.equal(appliedCookies[0].value, 'initial-synthetic-session')
    save('replacement-synthetic-session', '.amazon.co.uk')
    assert.equal(getAmazonDomain(), 'amazon.co.uk')
    await createBrowserAndPage(true)
    assert.equal(appliedCookies[0].value, 'replacement-synthetic-session')
    rmSync(cookiePath)
    await assert.rejects(createBrowserAndPage(true), /Amazon login required/)
    assert.equal(launches, 2)
    save('new-synthetic-login', '.amazon.com')
    await createBrowserAndPage(true)
    assert.equal(appliedCookies[0].value, 'new-synthetic-login')
    writeFileSync(cookiePath, 'invalid json')
    await assert.rejects(createBrowserAndPage(true), /Error reading or parsing/)
    assert.equal(launches, 3)
  } finally {
    if (previous === undefined) delete process.env.AMAZON_COOKIES_FILE
    else process.env.AMAZON_COOKIES_FILE = previous
    rmSync(directory, { recursive: true, force: true })
  }
})
