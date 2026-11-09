import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { posix, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { verifyUpstream } from './upstream-check.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const MAX_BYTES = 64 * 1024 * 1024
export const RUNTIME_FILES = Object.freeze([
  'dist/index.js', 'dist/client.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json',
  'icon.svg', 'LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md', 'README.md',
])
const SOURCE_FILES = [
  'package.json', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json',
  'LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md', 'README.md', 'UPSTREAM.json',
  'pnpm-lock.yaml', 'tsconfig.json', 'hooks/logic.ts', 'hooks/i18n.ts', 'hooks/demo.ts',
  'types/index.d.ts', 'types/assets.d.ts', 'src/async.ts', 'src/board-engine.ts',
  'src/client.tsx', 'src/collector.ts', 'src/dsh-i18n.ts', 'src/host.ts',
  'src/native-board.ts', 'src/styles.css', 'scripts/build.mjs', 'scripts/check.mjs',
  'scripts/test.mjs', 'scripts/upstream-check.mjs', 'scripts/release-check.mjs',
  'tests/acceptance.test.ts', 'tests/client.test.ts', 'tests/collector.test.ts', 'tests/host.test.ts',
]
const OPTIONAL_FILES = [
  'SECURITY.md', 'RELEASING.md', '.gitignore', 'docs/PORTING-dsh.md', 'docs/DISTRIBUTION.md',
  'docs/images/demo-zh.png', 'plugin-index.json', ...RUNTIME_FILES,
]
const SOURCE_ALLOWLIST = new Set([...SOURCE_FILES, ...OPTIONAL_FILES])
const GENERATED_DIRS = new Set(['.git', 'node_modules', '.pnpm-store', '.test-build', 'artifacts'])
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const sorted = values => [...values].sort()

export function verifyManifest(pkg, { packed = false } = {}) {
  assert.equal(pkg.name, '@fstrategy/switchboard-dsh')
  assert.equal(pkg.version, '0.1.0')
  assert.equal(pkg.private, false)
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.engines.node, '>=24.9.0')
  assert.equal(pkg.engines.dsh, '0.2.2-rc.1')
  // pnpm pack omits this source-only development-tool pin. It must never change to another value.
  if (!packed || Object.hasOwn(pkg, 'packageManager')) assert.equal(pkg.packageManager, 'pnpm@11.28.5')
  assert.equal(pkg.repository.url, 'https://github.com/Fstrategy/switchboard-dsh.git')
  assert.equal(pkg.homepage, 'https://github.com/Fstrategy/switchboard-dsh#readme')
  assert.equal(pkg.bugs.url, 'https://github.com/Fstrategy/switchboard-dsh/issues')
  assert.deepEqual(sorted(pkg.files), sorted(RUNTIME_FILES), 'Use the exact runtime files allowlist')
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit')
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack', 'prepublish', 'prepublishOnly', 'publish', 'postpublish']) {
    assert.ok(!Object.hasOwn(pkg.scripts, hook), `No automatic install/pack/publish hooks: ${hook}`)
  }
  assert.equal(pkg.exports['.'], './dist/index.js')
  assert.equal(pkg.exports['./client'], './dist/client.js')
  assert.equal(pkg.exports['./icon'], './icon.svg')
  assert.equal(pkg.exports['./locale/*.json'], './locale/*.json')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
}

export function scanText(path, text, label = path) {
  const fail = (message, index) => {
    const line = text.slice(0, index).split('\n').length
    throw new Error(`${message}: ${label}:${line} (sensitive value omitted)`)
  }
  for (const match of text.matchAll(/(?:\/Users\/|\/home\/)([^\s/\\'"`<>]+)/g)) {
    if (!(path.startsWith('tests/') && match[1] === 'me')) fail('Personal home-directory identity', match.index)
  }
  for (const match of text.matchAll(/[A-Za-z]:\\{1,2}Users\\{1,2}([^\\/\s'"`<>]+)/g)) {
    if (!(path.startsWith('tests/') && match[1] === 'me')) fail('Personal Windows home-directory identity', match.index)
  }
  for (const match of text.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)) {
    // Zod's bundled UUID validator contains only the standard nil/max sentinels.
    if (!['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff'].includes(match[0].toLowerCase())) {
      fail('Concrete session/other UUID', match.index)
    }
  }
  for (const match of text.matchAll(/@local\/[A-Za-z0-9_.-]*/g)) {
    // The README documents removing the old prototype, never registering it.
    if (!(path === 'README.md' && match[0] === '@' + 'local/switchboard-dsh')) fail('Private package identity', match.index)
  }
  const forbidden = [
    [/https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?\b/gi, 'Local GUI URL'],
    [/-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/g, 'Private key'],
    [/\b(?:npm_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, 'Credential-like token'],
    [/"(?:packageLogPath|jumpClickedAt)"\s*:/g, 'Local verification receipt'],
  ]
  for (const [pattern, message] of forbidden) {
    const match = pattern.exec(text)
    if (match) fail(message, match.index)
  }
  assert.ok(!text.includes('\0'), `Unexpected NUL byte: ${label}`)
}

function checkPublicImage(path, bytes) {
  assert.equal(path, 'docs/images/demo-zh.png')
  assert.ok(bytes.length <= 2 * 1024 * 1024, 'Public crop exceeds the image size limit')
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Public crop must be PNG')
  let cursor = 8, dimensions = false, ended = false
  while (cursor + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(cursor)
    const type = bytes.toString('ascii', cursor + 4, cursor + 8)
    assert.ok(cursor + 12 + size <= bytes.length, 'Truncated PNG chunk')
    assert.ok(!['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type), 'Strip private text/EXIF metadata from the public image')
    if (type === 'IHDR') {
      assert.equal(cursor, 8)
      assert.equal(size, 13)
      assert.equal(bytes.readUInt32BE(cursor + 8), 572, 'Use only the reviewed right-panel crop')
      assert.equal(bytes.readUInt32BE(cursor + 12), 937, 'Use only the reviewed right-panel crop')
      dimensions = true
    }
    cursor += size + 12
    if (type === 'IEND') { assert.equal(size, 0); ended = true; break }
  }
  assert.ok(dimensions && ended && cursor === bytes.length, 'Invalid PNG structure/trailing data')
}

function scanBytes(path, bytes, label = path) {
  assert.ok(bytes.length <= MAX_BYTES, `Oversized candidate: ${label}`)
  if (path.endsWith('.png')) return checkPublicImage(path, bytes)
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  scanText(path, text, label)
}

function git(args) {
  const result = spawnSync('git', ['-C', ROOT, ...args], { maxBuffer: MAX_BYTES })
  if (result.error) throw result.error
  return result
}

async function sourceFiles() {
  const paths = []
  const visit = async (directory, prefix = '') => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + item.name
      // Only untracked generated data is ignored. Every index entry is checked below.
      if (!prefix && (GENERATED_DIRS.has(item.name) || /\.tgz$/.test(item.name))) continue
      assert.ok(!item.isSymbolicLink(), `No public source symlinks: ${path}`)
      if (item.isDirectory()) await visit(resolve(directory, item.name), `${path}/`)
      else {
        assert.ok(item.isFile() && SOURCE_ALLOWLIST.has(path), `Unexpected public source candidate: ${path}`)
        scanBytes(path, await readFile(resolve(directory, item.name)))
        paths.push(path)
      }
    }
  }
  await visit(ROOT)
  for (const required of SOURCE_FILES) assert.ok(paths.includes(required), `Missing public source file: ${required}`)
  let indexed = 0
  const top = git(['rev-parse', '--show-toplevel'])
  if (top.status === 0 && await realpath(top.stdout.toString('utf8').trim()) === await realpath(ROOT)) {
    const result = git(['ls-files', '--stage', '-z'])
    assert.equal(result.status, 0, 'Unable to inspect Git index')
    for (const row of result.stdout.toString('utf8').split('\0').filter(Boolean)) {
      const match = /^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/.exec(row)
      assert.ok(match, 'Malformed Git index entry')
      const [, mode, object, stage, path] = match
      assert.equal(stage, '0', `Unresolved Git index stage: ${path}`)
      assert.ok(['100644', '100755'].includes(mode), `No indexed symlink/submodule: ${path}`)
      assert.ok(SOURCE_ALLOWLIST.has(path), `Forbidden tracked/staged public file: ${path}`)
      const blob = git(['cat-file', 'blob', object])
      assert.equal(blob.status, 0, `Unable to read Git index blob: ${path}`)
      scanBytes(path, blob.stdout, `Git index ${path}`)
      assert.ok(blob.stdout.equals(await readFile(resolve(ROOT, path))), `Git index differs from checked working bytes; restage: ${path}`)
      indexed++
    }
  } else {
    assert.ok(top.status === 0 || top.status === 128, 'Unable to inspect repository location')
  }
  return { candidates: paths.length, indexed }
}

function tarString(bytes) {
  const end = bytes.indexOf(0)
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString('utf8')
}
function tarNumber(bytes) {
  const value = tarString(bytes).trim()
  assert.match(value || '0', /^[0-7]+$/, 'Unsupported tar numeric encoding')
  const number = Number.parseInt(value || '0', 8)
  assert.ok(Number.isSafeInteger(number) && number >= 0, 'Invalid tar size/checksum')
  return number
}

export function readTar(bytes) {
  assert.ok(bytes.length <= MAX_BYTES && bytes.length % 512 === 0, 'Invalid/oversized tar stream')
  const files = new Map()
  let cursor = 0, ended = false
  while (cursor + 512 <= bytes.length) {
    const header = bytes.subarray(cursor, cursor + 512)
    if (header.every(byte => byte === 0)) {
      assert.ok(bytes.length - cursor >= 1024 && bytes.subarray(cursor).every(byte => byte === 0), 'Invalid tar trailer')
      ended = true; break
    }
    let checksum = 0
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]
    assert.equal(checksum, tarNumber(header.subarray(148, 156)), 'Tar header checksum mismatch')
    const name = tarString(header.subarray(0, 100))
    const prefix = tarString(header.subarray(345, 500))
    const path = prefix ? `${prefix}/${name}` : name
    assert.ok(/^package\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]*$/.test(path), 'Unexpected archive member path')
    assert.ok(!path.split('/').some(part => part === '..' || part === '.'), 'Unsafe archive path')
    const size = tarNumber(header.subarray(124, 136))
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156])
    assert.ok(['0', '5'].includes(type), 'No tar links, devices, PAX or extended-path entries')
    assert.equal(tarString(header.subarray(157, 257)), '', 'Unexpected tar link target')
    assert.ok(['', 'root'].includes(tarString(header.subarray(265, 297))), 'No personal tar owner name')
    assert.ok(['', 'root'].includes(tarString(header.subarray(297, 329))), 'No personal tar group name')
    assert.ok(header.subarray(500).every(byte => byte === 0), 'Unexpected hidden tar header data')
    const start = cursor + 512
    assert.ok(size <= MAX_BYTES && start + size <= bytes.length, 'Truncated/oversized tar member')
    if (type === '5') {
      assert.ok(['package/', 'package/dist/', 'package/locale/'].includes(path) && size === 0, 'Unexpected archive directory')
    } else {
      assert.ok(!files.has(path), `Duplicate archive member: ${path}`)
      files.set(path, bytes.subarray(start, start + size))
    }
    cursor = start + Math.ceil(size / 512) * 512
    assert.ok(bytes.subarray(start + size, cursor).every(byte => byte === 0), 'Unexpected hidden tar member padding')
  }
  assert.ok(ended, 'Missing tar trailer')
  return files
}

function checkRelativeLinks(path, text, files) {
  const links = /!?\[[^\]]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g
  for (const match of text.matchAll(links)) {
    const href = match[1] ?? match[2]
    if (href.startsWith('#') || /^https:\/\//i.test(href)) continue
    assert.ok(!/^[A-Za-z][A-Za-z0-9+.-]*:|^\//.test(href), `Unsupported package documentation link: ${path}`)
    const target = decodeURIComponent(href.split(/[?#]/)[0])
    const joined = posix.normalize(posix.join(posix.dirname(path), target))
    assert.ok(files.has(`package/${joined}`), `Broken relative package link: ${path} -> ${target}`)
  }
}

export function comparePackedManifest(source, packed) {
  const expected = structuredClone(source)
  // npm-format packers may reserialize JSON and pnpm removes packageManager. No other field changes are allowed.
  if (!Object.hasOwn(packed, 'packageManager')) delete expected.packageManager
  assert.deepEqual(packed, expected, 'Only packageManager omission/JSON serialization may differ in packed manifest')
}

export async function verifyArchive(archive) {
  assert.ok((await lstat(archive)).isFile(), 'Archive must be a regular file, not a symlink')
  const compressed = await readFile(archive)
  assert.ok(compressed.length <= MAX_BYTES && compressed[0] === 31 && compressed[1] === 139, 'Expected a gzip-compressed npm-format tarball')
  assert.equal(compressed[3], 0, 'No gzip filename, comment or extended metadata')
  const files = readTar(gunzipSync(compressed, { maxOutputLength: MAX_BYTES }))
  const expected = ['package.json', ...RUNTIME_FILES]
  assert.deepEqual(sorted(files.keys()), sorted(expected.map(path => `package/${path}`)), 'Archive must contain exactly the runtime allowlist')
  const packedManifest = JSON.parse(files.get('package/package.json').toString('utf8'))
  verifyManifest(packedManifest, { packed: true })
  const sourceManifest = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'))
  verifyManifest(sourceManifest)
  comparePackedManifest(sourceManifest, packedManifest)
  for (const path of expected) {
    const bytes = files.get(`package/${path}`)
    scanBytes(path, bytes, `archive ${path}`)
    const local = resolve(ROOT, path)
    assert.ok((await lstat(local)).isFile(), `Not a regular release input: ${path}`)
    if (path !== 'package.json') assert.ok(bytes.equals(await readFile(local)), `Packed bytes differ from verified release input: ${path}`)
    if (path.endsWith('.md')) checkRelativeLinks(path, bytes.toString('utf8'), files)
  }
  return { files: files.size, sha256: sha256(compressed) }
}

function selfTest() {
  scanText('tests/example.test.ts', '/' + ['Users', 'me', 'example'].join('/'))
  assert.throws(() => scanText('README.md', '/' + ['Users', 'private-person', 'work'].join('/')), /home-directory/)
  assert.throws(() => scanText('README.md', 'http://' + '127.' + '0.0.1:12345'), /GUI URL/)
  assert.throws(() => scanText('README.md', ['12345678', '1234', '4234', '8234', '123456789abc'].join('-')), /UUID/)
  assert.throws(() => scanText('README.md', 'npm_' + 'a'.repeat(40)), /token/)
  assert.throws(() => scanText('README.md', '@' + 'local/example'), /package identity/)
  scanText('README.md', '@' + 'local/switchboard-dsh')
  assert.throws(() => scanText('src/client.tsx', '@' + 'local/switchboard-dsh'), /package identity/)
  const sourceManifest = { name: 'example', private: false, packageManager: 'pnpm@11.28.5' }
  comparePackedManifest(sourceManifest, { name: 'example', private: false })
  comparePackedManifest(sourceManifest, structuredClone(sourceManifest))
  assert.throws(() => comparePackedManifest(sourceManifest, { name: 'different', private: false }), /packed manifest/)
  assert.throws(() => comparePackedManifest(sourceManifest, { name: 'example', private: false, packageManager: 'different' }), /packed manifest/)
  const member = (name, type = '0') => {
    const header = Buffer.alloc(512)
    header.write(name)
    header.write('00000000000\0', 124)
    header[156] = type.charCodeAt(0)
    header.fill(32, 148, 156)
    const sum = header.reduce((total, byte) => total + byte, 0)
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
    return header
  }
  const end = Buffer.alloc(1024)
  assert.equal(readTar(Buffer.concat([member('package/LICENSE'), end])).size, 1)
  assert.throws(() => readTar(Buffer.concat([member('package/LICENSE'), member('package/LICENSE'), end])), /Duplicate/)
  assert.throws(() => readTar(Buffer.concat([member('package/../LICENSE'), end])), /Unsafe/)
  assert.throws(() => readTar(Buffer.concat([member('package/LICENSE', '2'), end])), /links/)
  const corrupt = member('package/LICENSE'); corrupt[0] ^= 1
  assert.throws(() => readTar(Buffer.concat([corrupt, end])), /checksum/)
  console.log('PASS: release guard self-tests (privacy, duplicate/traversal/link/checksum tar defenses)')
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== '--')
  if (args.length === 1 && args[0] === '--self-test') return selfTest()
  const sourceOnly = args.length === 1 && args[0] === '--source-only'
  assert.ok(sourceOnly || (args.length === 1 && !args[0].startsWith('-')),
    'Usage: node scripts/release-check.mjs --source-only | path/to/release.tgz | --self-test')
  await verifyUpstream()
  verifyManifest(JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')))
  const source = await sourceFiles()
  console.log(`PASS: ${source.candidates} allowlisted public candidates; ${source.indexed} Git-index blobs checked; upstream bytes intact`)
  if (sourceOnly) {
    console.log('Source-only check: no archive, installation, rendered UI or publication claim is made.')
    return
  }
  const archive = await verifyArchive(resolve(args[0]))
  console.log(`PASS: exact ${archive.files}-file runtime archive; SHA-256 ${archive.sha256}`)
  console.log('GitHub Release bundle only: no npm-registry publication or runtime/UI installation was performed by this check.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() }
  catch (error) {
    console.error(`FAIL: ${String(error?.message ?? error).replaceAll(ROOT, './')}`)
    process.exitCode = 1
  }
}
