import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const client = await readFile(new URL('../src/client.tsx', import.meta.url), 'utf8')
assert.equal(pkg.name, '@fstrategy/switchboard-dsh')
assert.equal(client.match(/^export const PACKAGE_ID = (['"])([^'"]+)\1$/m)?.[2], pkg.name,
  'Client registration id must match the public package name')
await mkdir(new URL('../dist/', import.meta.url), { recursive: true })
await build({ absWorkingDir: root, entryPoints: ['src/host.ts'], bundle: true, platform: 'node',
  target: 'node24', format: 'esm', outfile: 'dist/index.js', sourcemap: false, legalComments: 'inline' })
await build({ absWorkingDir: root, entryPoints: ['src/client.tsx'], bundle: true, platform: 'browser',
  target: 'es2022', format: 'cjs', external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
  loader: { '.css': 'text' }, outfile: 'dist/client.js', sourcemap: false,
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory(require){const module={exports:{}};const exports=module.exports;` },
  footer: { js: 'return module.exports;}});' }, legalComments: 'inline' })
console.log('Built native Host and Client bundles (no application server).')
