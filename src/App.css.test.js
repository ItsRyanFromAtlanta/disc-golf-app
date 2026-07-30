import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Structural guard for the one file in this repo nothing else checks.
//
// `App.css` is a single ~5,000-line stylesheet that every feature appends to,
// which makes it the file most likely to be edited by two branches at once and
// the least likely to survive it. On 2026-07-30 a clean auto-merge of two
// feature branches — no conflict reported, no test failure, no build error —
// produced 844 open braces against 842 closes: two unterminated blocks, rules
// interleaved into each other, and four declarations silently dropped from
// `.round-bag`, which left that panel with no card surface.
//
// Nothing in the toolchain catches that. oxlint does not read CSS, Vite does
// not validate it (a malformed block is dropped or absorbed at build time
// rather than raising), and no unit or browser test asserts a computed style.
// The corruption reached the branch of record and was found by inspection.
//
// These assertions are deliberately structural rather than stylistic. They are
// not a linter and should not grow into one — they exist to fail loudly on the
// specific damage a bad merge does, which is exactly the damage that otherwise
// ships silently.
const css = readFileSync(fileURLToPath(new URL('./App.css', import.meta.url)), 'utf8')

// Strip comments and quoted strings first: a brace inside either is not
// structural, and `content: '}'` is legitimate CSS that would otherwise skew
// the count.
function structuralCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
}

describe('App.css structure', () => {
  const stripped = structuralCss(css)

  it('balances every block it opens', () => {
    const opens = (stripped.match(/\{/g) ?? []).length
    const closes = (stripped.match(/\}/g) ?? []).length
    expect({ opens, closes }).toEqual({ opens: closes, closes })
  })

  it('never leaves a block open at end of file', () => {
    let depth = 0
    let minDepth = 0
    for (const char of stripped) {
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      if (depth < minDepth) minDepth = depth
    }
    // depth > 0 is an unterminated rule; depth < 0 at any point is a stray
    // close, which is how interleaved rules from a bad merge present.
    expect({ finalDepth: depth, everNegative: minDepth < 0 }).toEqual({
      finalDepth: 0,
      everNegative: false,
    })
  })

  it('opens no rule whose selector already contains a declaration', () => {
    // `.a { color: red .b {` — the signature of one rule spliced into another.
    // A selector may legitimately contain a colon (`:hover`, `::before`,
    // `[data-x="y"]`), so key off the semicolon, which never appears in one.
    const spliced = [...stripped.matchAll(/\{([^{}]*);[^{}]*\{/g)].map((match) =>
      match[0].slice(0, 80).replace(/\s+/g, ' '),
    )
    expect(spliced).toEqual([])
  })
})
