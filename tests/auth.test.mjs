import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let launches = 0
mock.module('../build/config.js', { namedExports: {
  COOKIES_FILE_PATH: '/missing/amazonCookies.json', IS_BROWSER_VISIBLE: false,
} })
mock.module('puppeteer', { defaultExport: { launch: async () => {
  launches++
  throw new Error('Browser must not launch without account credentials')
} } })
const { createBrowserAndPage } = await import('../build/utils.js')

test('account requests fail before browser launch when login cookies are missing', async () => {
  await assert.rejects(createBrowserAndPage(true), /Amazon login required.*amazonCookies.json/)
  assert.equal(launches, 0)
})
