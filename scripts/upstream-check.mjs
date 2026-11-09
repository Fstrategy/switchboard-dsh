import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPOSITORY = 'https://github.com/Fstrategy/switchboard'
const COMMIT = '07b07b63fc56add654f62f823fd1e8105fd2c8a8'
// Fixed upstream bytes, not hashes regenerated from the current working tree.
const HASHES = {
  LICENSE: '84cc2ce7d704de05dcefadc88cba8d82c581b43b50304ddf0abc15699c32268b',
  'hooks/logic.ts': '9fdf8328d3dadc402647d303f6f6ae3ebb04f05c8911d0ce22b77449a6000544',
  'hooks/i18n.ts': '25081dbaba9a86763641a65fdc6a29e978452d94c29ea1faeb8f72be2d9be840',
  'hooks/demo.ts': '15c6be7cbce17c9bde029bc4b48896d4f4a72ff96087a15261100caecb89a304',
}

export async function verifyUpstream(root = ROOT) {
  const provenance = JSON.parse(await readFile(resolve(root, 'UPSTREAM.json'), 'utf8'))
  assert.equal(provenance.repository, REPOSITORY)
  assert.equal(provenance.commit, COMMIT)
  assert.equal(provenance.version, '0.1.0')
  assert.equal(provenance.license, 'MIT')
  assert.equal(provenance.copyright, 'Copyright (c) 2026 Lumir')
  assert.deepEqual(Object.keys(provenance.files).sort(), Object.keys(HASHES).sort())
  for (const [path, expected] of Object.entries(HASHES)) {
    assert.equal(provenance.files[path].source, path, `Wrong upstream path: ${path}`)
    assert.equal(provenance.files[path].sha256, expected, `Changed provenance hash: ${path}`)
    assert.ok((await lstat(resolve(root, path))).isFile(), `Not a regular upstream file: ${path}`)
    const actual = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
    assert.equal(actual, expected, `Preserve upstream bytes unchanged: ${path}`)
  }
  return { repository: REPOSITORY, commit: COMMIT, files: Object.keys(HASHES) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyUpstream()
  console.log(`PASS: four unchanged upstream files and provenance pinned to ${COMMIT}`)
}
