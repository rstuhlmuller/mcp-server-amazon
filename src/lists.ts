import * as cheerio from 'cheerio'
import fs from 'node:fs'
import type { Page } from 'puppeteer'
import { z } from 'zod'
import { USE_MOCKS, getAmazonDomain } from './config.js'
import { createBrowserAndPage, throwIfNotLoggedIn } from './utils.js'

export const listIdSchema = z.string().regex(/^[A-Z0-9]+$/, 'List ID must contain only uppercase letters and digits.').max(64)
export const listAsinSchema = z.string().regex(/^[A-Z0-9]{10}$/, 'ASIN must be 10 uppercase letters or digits.')

function listUrl(listId: string) {
  return `https://www.${getAmazonDomain()}/hz/wishlist/ls/${listId}`
}

function extractLists(html: string) {
  const $ = cheerio.load(html)
  const lists = new Map<string, { listId: string; name: string; url: string }>()
  $('#your-lists-nav a[href], #wl-list-entry a[href], a[id^="wl-list-entry-"]').each((_, element) => {
    const link = $(element)
    const listId = link.attr('href')?.match(/\/(?:hz\/wishlist\/ls|gp\/registry\/wishlist)\/([A-Z0-9]+)(?:[/?#]|$)/)?.[1]
    const name = link.find('[id^="wl-list-entry-title-"]').text().trim() || link.attr('title') || link.text().trim()
    if (listId && name) lists.set(listId, { listId, name, url: listUrl(listId) })
  })
  if (!$('#your-lists-nav, #wl-list-entry, #wl-list-info, #list-create').length && !lists.size) {
    throw new Error('Could not read Amazon Lists. Check login, access, or changed page markup.')
  }
  return [...lists.values()]
}

function extractItems(html: string) {
  const $ = cheerio.load(html)
  if (!$('#g-items, #wl-list-info, #empty-list, #g-items-ended').length) {
    throw new Error('Could not read this List. Check the List ID, access, or changed page markup.')
  }
  const items: { asin: string; title: string; productUrl: string; price?: string; image?: string }[] = []
  $('#g-items li[data-itemid], #g-items .g-item-sortable').each((_, element) => {
    const row = $(element)
    const link = row.find('a[id^="itemName_"]').first()
    const asin = link.attr('href')?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/)?.[1]
    const title = link.attr('title') || link.text().trim()
    if (asin && title) {
      items.push({ asin, title, productUrl: `https://www.${getAmazonDomain()}/dp/${asin}`,
        price: row.find('.a-price .a-offscreen, [id^="itemPrice_"]').first().text().trim() || undefined,
        image: row.find('img').first().attr('src') })
    }
  })
  return items
}

async function readItems(page: Page, listId: string) {
  await page.goto(listUrl(listId), { waitUntil: 'networkidle2', timeout: 30000 })
  await throwIfNotLoggedIn(page)
  await page.waitForSelector('#g-items, #wl-list-info, #empty-list', { timeout: 10000 })
  let complete = false
  // shortcut: cap lazy loading at 50 batches; add pagination if larger Lists are needed.
  for (let batch = 0; batch < 50; batch++) {
    if (await page.$('#g-items-ended, #empty-list')) {
      complete = true
      break
    }
    const count = await page.$$eval('#g-items li[data-itemid]', rows => rows.length)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    try {
      await page.waitForFunction(previous =>
        document.querySelectorAll('#g-items li[data-itemid]').length > previous ||
        !!document.querySelector('#g-items-ended, #empty-list'), { timeout: 5000 }, count)
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error
      break
    }
  }
  return { listId, items: extractItems(await page.content()), complete }
}

export async function listLists() {
  if (USE_MOCKS) return extractLists(fs.readFileSync(new URL('../mocks/listLists.html', import.meta.url), 'utf8'))
  const { browser, page } = await createBrowserAndPage()
  try {
    await page.goto(`https://www.${getAmazonDomain()}/hz/wishlist/ls?requiresSignIn=1`, { waitUntil: 'networkidle2', timeout: 30000 })
    await throwIfNotLoggedIn(page)
    await page.waitForSelector('#your-lists-nav, #wl-list-entry, #wl-list-info, #list-create', { timeout: 10000 })
    return extractLists(await page.content())
  } finally {
    await browser.close()
  }
}

export async function listItems(listId: string) {
  listIdSchema.parse(listId)
  if (USE_MOCKS) return { listId, items: extractItems(fs.readFileSync(new URL('../mocks/listItems.html', import.meta.url), 'utf8')), complete: true }
  const { browser, page } = await createBrowserAndPage()
  try {
    return await readItems(page, listId)
  } finally {
    await browser.close()
  }
}

export async function addToList(listId: string, asin: string) {
  listIdSchema.parse(listId)
  listAsinSchema.parse(asin)
  if (USE_MOCKS) throw new Error('Adding to a List is disabled in mock mode.')
  const { browser, page } = await createBrowserAndPage()
  try {
    await page.goto(`https://www.${getAmazonDomain()}/-/en/gp/product/${asin}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await throwIfNotLoggedIn(page)
    // Open the selector, never the default-list submit button.
    await page.waitForSelector('#add-to-wishlist-button', { visible: true, timeout: 10000 })
    await page.click('#add-to-wishlist-button')
    const target = `#atwl-link-to-list-${listId}, [data-action="atwl-add-to-list"][data-list-id="${listId}"]`
    await page.waitForSelector(target, { visible: true, timeout: 10000 })
    await page.click(target)
    await page.waitForSelector('#atwl-inline-link, #WLHUC_result', { visible: true, timeout: 10000 })
    const result = await readItems(page, listId)
    if (!result.items.some(item => item.asin === asin)) {
      throw new Error('Add was attempted, but the product could not be verified in the selected List. Check the List before retrying.')
    }
    return { success: true, listId, asin, url: listUrl(listId) }
  } finally {
    await browser.close()
  }
}
