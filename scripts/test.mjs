import { build } from 'esbuild'
import { readdir, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const files = (await readdir('tests')).filter(f => /\.test\.tsx?$/.test(f)).sort()
await mkdir('.test-build', { recursive: true })
for (const file of files) await build({ entryPoints: [`tests/${file}`], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: `.test-build/${file.replace(/\.tsx?$/, '.mjs')}`, jsx: 'automatic', loader: { '.css': 'text' } })
const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...files.map(f => `.test-build/${f.replace(/\.tsx?$/, '.mjs')}`)], { stdio: 'inherit' })
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
