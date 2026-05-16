/**
 * Bundles the Express API server (+ all routes + SQLite db setup)
 * into a single CJS file for use inside Electron.
 *
 * Run from the repo ROOT:  node electron-app/build-server-bundle.mjs
 */
import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.resolve(__dirname, '..')

await build({
  entryPoints : [path.join(__dirname, 'electron-server-entry.ts')],
  bundle      : true,
  platform    : 'node',
  format      : 'cjs',
  target      : 'node20',
  external    : ['better-sqlite3', 'electron', '*.node'],
  outfile     : path.join(__dirname, 'src', 'server-bundle.cjs'),
  tsconfig    : path.join(root, 'artifacts', 'api-server', 'tsconfig.json'),
  nodePaths   : [
    path.join(root, 'node_modules'),
    path.join(root, 'artifacts', 'api-server', 'node_modules'),
  ],
  banner: {
    js: `
const __importMetaUrl = (f => typeof f === "string" ? f : f.href)(typeof __filename !== "undefined" ? require("url").pathToFileURL(__filename) : import.meta.url);
if (typeof globalThis.__importMetaUrlPolyfill === "undefined") {
  globalThis.__importMetaUrlPolyfill = __importMetaUrl;
}
`.trim()
  },
  define: {
    'import.meta.url': '__importMetaUrlPolyfill',
  },
})

console.log('server-bundle.cjs written to electron-app/src/')
