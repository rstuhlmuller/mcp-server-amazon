import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock, test } from 'node:test'

const listsHtml = readFileSync(new URL('../mocks/listLists.html', import.meta.url), 'utf8')
const itemsHtml = readFileSync(new URL('../mocks/listItems.html', import.meta.url), 'utf8')
let html, clicks, closed, loginError, missingTarget, waitError, ended, batches
mock.module('../build/config.js', { namedExports: { USE_MOCKS: false, getAmazonDomain: () => 'amazon.co.uk' } })
mock.module('../build/utils.js', { namedExports: {
  createBrowserAndPage: async () => ({
    browser: { close: async () => { closed++ } },
    page: {
      goto: async () => {},
      waitForSelector: async selector => {
        if (waitError || (missingTarget && selector.includes('atwl-link-to-list'))) throw new Error('Selector unavailable')
      },
      click: async selector => { clicks.push(selector) },
      $: async () => ended ? {} : null,
      $$eval: async () => 2,
      evaluate: async () => {},
      waitForFunction: async () => {
        batches++
        const error = new Error('No more rows loaded')
        error.name = 'TimeoutError'
        throw error
      },
      content: async () => html,
    },
  }),
  throwIfNotLoggedIn: async () => { if (loginError) throw new Error('Login required') },
} })
const { listLists, listItems, addToList } = await import('../build/lists.js')

function reset(content = itemsHtml) {
  html = content
  clicks = []
  closed = 0
  loginError = missingTarget = waitError = false
  ended = true
  batches = 0
}

test('discovers named lists, deduplicates IDs, and uses the cookie marketplace', async () => {
  reset(listsHtml)
  assert.deepEqual(await listLists(), [
    { listId: 'ABC123', name: 'Office', url: 'https://www.amazon.co.uk/hz/wishlist/ls/ABC123' },
    { listId: 'XYZ789', name: 'Gifts', url: 'https://www.amazon.co.uk/hz/wishlist/ls/XYZ789' },
  ])
  assert.equal(closed, 1)
})

test('reads products including unavailable items without prices', async () => {
  reset()
  const result = await listItems('ABC123')
  assert.equal(result.complete, true)
  assert.deepEqual(result.items.map(({ asin, title, price, productUrl }) => ({ asin, title, price, productUrl })), [
    { asin: 'B012345678', title: 'Desk lamp', price: '$20.00', productUrl: 'https://www.amazon.co.uk/dp/B012345678' },
    { asin: 'B087654321', title: 'Unavailable item', price: undefined, productUrl: 'https://www.amazon.co.uk/dp/B087654321' },
  ])
  assert.equal(closed, 1)
})

test('distinguishes empty lists from inaccessible or changed pages', async () => {
  reset('<div id="empty-list"></div>')
  assert.deepEqual((await listItems('ABC123')).items, [])
  reset('<html>Access denied</html>')
  await assert.rejects(listItems('ABC123'), /Could not read/)
  assert.equal(closed, 1)
})

test('reports incomplete lazy loading instead of claiming all products', async () => {
  reset()
  ended = false
  assert.equal((await listItems('ABC123')).complete, false)
  assert.equal(batches, 1)
})

test('adds only to the specified list and verifies membership', async () => {
  reset()
  assert.equal((await addToList('ABC123', 'B012345678')).success, true)
  assert.deepEqual(clicks, ['#add-to-wishlist-button', '#atwl-link-to-list-ABC123, [data-action="atwl-add-to-list"][data-list-id="ABC123"]'])
  assert.equal(closed, 1)
})

test('does not fall back to a default list when selected list is absent', async () => {
  reset()
  missingTarget = true
  await assert.rejects(addToList('ABC123', 'B012345678'), /Selector unavailable/)
  assert.deepEqual(clicks, ['#add-to-wishlist-button'])
  assert.equal(closed, 1)
})

test('does not report success without the product in the selected list', async () => {
  reset()
  await assert.rejects(addToList('ABC123', 'B000000000'), /could not be verified/)
  assert.equal(closed, 1)
})

test('rejects unsafe IDs and ASINs before opening a browser', async () => {
  reset()
  await assert.rejects(listItems('../other'))
  await assert.rejects(addToList('ABC123', 'bad"value!'))
  assert.equal(closed, 0)
  assert.deepEqual(clicks, [])
})

test('closes browsers after login and selector failures', async () => {
  for (const operation of [listLists, () => listItems('ABC123'), () => addToList('ABC123', 'B012345678')]) {
    reset()
    loginError = true
    await assert.rejects(operation(), /Login required/)
    assert.equal(closed, 1)
    reset()
    waitError = true
    await assert.rejects(operation(), /Selector unavailable/)
    assert.equal(closed, 1)
  }
})
