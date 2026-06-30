/**
 * Automated fetch() → api() migration script.
 *
 * For every .ts/.tsx file under src/ that calls fetch("/api…):
 *   1. Determine the correct relative import path to src/lib/api.ts
 *   2. Insert `import { api } from '…'` after the last existing import
 *   3. Replace fetch("/api  →  api("/api  and  fetch(`/api  →  api(`/api
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'

const DIR = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(DIR, 'src')
const API_MODULE = join(SRC, 'lib', 'api')

const EXTS = new Set(['.ts', '.tsx'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect .ts/.tsx files under dir. */
function collectFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...collectFiles(full))
    } else if (entry.isFile() && EXTS.has(extname(entry.name))) {
      results.push(full)
    }
  }
  return results
}

function extname(name) {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx).toLowerCase()
}

/**
 * POSIX relative import path from `file` to the api module (no extension).
 */
function importPath(file) {
  let rel = relative(join(file, '..'), API_MODULE)
  rel = rel.split(sep).join('/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function isImport(line) {
  const t = line.trimStart()
  return t.startsWith('import ') || t.startsWith('export ')
}

/**
 * Insert `import { api } from '…'` after the last top-level import, or at
 * the top of the file if none exist.
 */
function insertImport(content, impPath) {
  const needle = `from '${impPath}'`
  if (content.includes(needle)) return content

  const lines = content.split('\n')

  let lastImportIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (isImport(lines[i])) {
      lastImportIdx = i
    } else if (lastImportIdx !== -1 && lines[i].trim() !== '' && !isImport(lines[i])) {
      break
    }
  }

  const insertAt = lastImportIdx !== -1 ? lastImportIdx + 1 : 0
  const prefix =
    insertAt > 0 &&
    lines[insertAt] !== undefined &&
    lines[insertAt].trim() !== ''
      ? '\n'
      : ''
  lines.splice(insertAt, 0, `${prefix}import { api } from '${impPath}'`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = collectFiles(SRC)

let changed = 0
let skipped = 0
let error = 0

for (const filePath of files) {
  let content
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    continue
  }

  const hasFetchApi = content.includes('fetch("/api') || content.includes('fetch(`/api')
  if (!hasFetchApi) {
    skipped++
    continue
  }

  const oldContent = content

  // 1. Add import
  content = insertImport(content, importPath(filePath))

  // 2. Replace fetch("/api  →  api("/api  and  fetch(`/api  →  api(`/api
  content = content.replace(/fetch\("\/api/g, 'api("/api')
  content = content.replace(/fetch\(`\/api/g, 'api(`/api')

  if (content === oldContent) {
    skipped++
    continue
  }

  try {
    writeFileSync(filePath, content, 'utf-8')
    const rel = relative(SRC, filePath)
    console.log(`✔ ${rel}`)
    changed++
  } catch (err) {
    const rel = relative(SRC, filePath)
    console.error(`✘ ${rel} — ${err.message}`)
    error++
  }
}

console.log(`\nDone. ${changed} updated, ${skipped} skipped, ${error} errors.`)
