import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const marketplace = path.join(root, 'dist/amazon-marketplace')
const plugin = path.join(marketplace, 'plugins/amazon-local')
rmSync(marketplace, { recursive: true, force: true })
mkdirSync(path.join(marketplace, '.agents/plugins'), { recursive: true })
cpSync(path.join(root, 'plugin'), plugin, { recursive: true })
// Copy only runtime files; never include cookies, captured HTML, or Git metadata.
for (const name of ['build', 'node_modules', 'package.json', 'LICENSE']) {
  cpSync(path.join(root, name), path.join(plugin, name), { recursive: true })
}
mkdirSync(path.join(plugin, 'mocks'))
writeFileSync(path.join(plugin, 'mcp.json'), JSON.stringify({ mcpServers: {
  amazon: {
    type: 'stdio', command: process.execPath,
    args: ['${PLUGIN_ROOT}/build/index.js'], cwd: '${PLUGIN_ROOT}',
    env: { AMAZON_COOKIES_FILE: path.join(root, 'amazonCookies.json') },
  },
} }, null, 2) + '\n')
writeFileSync(path.join(marketplace, '.agents/plugins/marketplace.json'), JSON.stringify({
  name: 'amazon-local-marketplace',
  interface: { displayName: 'Amazon Local' },
  plugins: [{ name: 'amazon-local', source: { source: 'local', path: './plugins/amazon-local' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }],
}, null, 2) + '\n')
console.log(marketplace)
