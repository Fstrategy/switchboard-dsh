import { lstat, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { build } from 'esbuild'
import { verifyManifest } from './release-check.mjs'
import { verifyUpstream } from './upstream-check.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
verifyManifest(pkg)
await verifyUpstream(root)
const patches = parse(await readFile(pkg.dsh.bundle.patch, 'utf8'))
assert.equal(patches.length, 1)
assert.equal(patches[0].insert.length, 1)
const entry = patches[0].insert[0]
assert.equal(entry.id, 'switchboard-dsh')
assert.equal(entry.name, pkg.name)
assert.deepEqual(entry.config, { summaries: false, modelMode: 'fake', language: 'auto', openPane: 'auto' })
for (const path of [pkg.exports['.'], pkg.exports['./client'], pkg.exports['./icon'], 'LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md', 'README.md', 'locale/en.json', 'locale/zh.json']) {
  assert.ok((await lstat(path)).isFile(), `Missing/non-regular exported resource: ${path}`)
}
for (const lang of ['en', 'zh']) {
  const metadata = JSON.parse(await readFile(`locale/${lang}.json`, 'utf8')).meta
  assert.ok(metadata.title && metadata.description)
}
assert.ok((await lstat(pkg.exports['./icon'])).size <= 256 * 1024)
const icon = await readFile(pkg.exports['./icon'], 'utf8')
assert.match(icon, /^<svg\b/)
assert.match(icon, /<\/svg>\s*$/)
assert.ok(!/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=|<!ENTITY/i.test(icon), 'Icon must be standalone artwork')
const css = await readFile('src/styles.css', 'utf8')
assert.ok(!/#(?:[a-f\d]{3}|[a-f\d]{6})\b|rgba?\(|hsla?\(/i.test(css), 'UI must use theme tokens')
assert.ok([...css.matchAll(/var\((--[^),]+)/g)].every(m => m[1].startsWith('--dsw-alias-')))
const source = await readFile('src/client.tsx', 'utf8')
assert.equal(source.match(/^export const PACKAGE_ID = (['"])([^'"]+)\1$/m)?.[2], pkg.name)
assert.ok(!/from\s+['"]@deepseek-ai\/dsh-client/.test(source), 'No private Harness Client imports')
assert.ok(!/document\.(body|head)|createRoot|iframe|dangerouslySetInnerHTML/.test(source.replace(/^\s*\/\/.*$/gm, '')), 'No second app or external DOM mutations')
const client = await readFile(pkg.exports['./client'], 'utf8')
assert.ok(client.startsWith(`window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory(require)`), 'Built module loader id must match the manifest')
assert.equal(client.match(/\b(?:var|const|let)\s+PACKAGE_ID\s*=\s*(['"])([^'"]+)\1/)?.[2], pkg.name, 'Built Client registration id must match')
for (const path of [pkg.exports['.'], pkg.exports['./client']]) {
  const bundle = await readFile(path, 'utf8')
  assert.ok(!/@local\//.test(bundle), `No private namespace in ${path}`)
  assert.ok(!/\/\/[#@]\s*sourceMappingURL=/.test(bundle), `No source maps in ${path}`)
}
await build({ absWorkingDir: root, entryPoints: ['src/host.ts'], bundle: true, platform: 'node', target: 'node24', format: 'esm', write: false })
console.log('PASS: public identity, safe bundle patch, exported resources, native UI guards, built Client ids and Host syntax')
console.log('TypeScript typechecking is separate: pnpm run typecheck. Actual archive/privacy verification: pnpm run release:check -- path/to/release.tgz')
