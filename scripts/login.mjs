import puppeteer from 'puppeteer'
import { chmodSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cookiePath = process.env.AMAZON_COOKIES_FILE || fileURLToPath(new URL('../amazonCookies.json', import.meta.url))
const browser = await puppeteer.launch({ headless: false, defaultViewport: null })
try {
  const page = await browser.newPage()
  await page.goto('https://www.amazon.com/hz/wishlist/ls?requiresSignIn=1', { waitUntil: 'domcontentloaded', timeout: 30000 })
  console.log('Sign in to Amazon in the browser window. Complete any verification there. Waiting up to 10 minutes.')
  const deadline = Date.now() + 10 * 60 * 1000
  let authenticated = false
  while (Date.now() < deadline) {
    const cookies = (await browser.cookies()).filter(cookie =>
      cookie.domain === 'amazon.com' || cookie.domain.endsWith('.amazon.com'))
    if (cookies.some(cookie => cookie.name === 'at-main' && cookie.value)) {
      // Keep session credentials out of stdout and protect both new and existing files.
      const temporaryPath = `${cookiePath}.bak.login`
      writeFileSync(temporaryPath, JSON.stringify(cookies), { mode: 0o600, flag: 'wx' })
      chmodSync(temporaryPath, 0o600)
      renameSync(temporaryPath, cookiePath)
      authenticated = true
      console.log('Amazon session saved. The plugin will load it on the next request.')
      break
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (!authenticated) throw new Error('Amazon sign-in was not completed within 10 minutes. No cookies saved.')
} finally {
  await browser.close()
}
