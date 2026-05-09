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
  // esbuild replaces import.meta.url with a CJS-compatible equivalent
  // when format=cjs, so no manual define needed.
})

console.log('✓  server-bundle.cjs written to electron-app/src/')
