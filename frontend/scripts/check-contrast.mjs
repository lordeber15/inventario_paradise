// Reads the palette straight out of src/index.css and asserts every colour
// pair the UI actually renders clears WCAG AA. The docs claimed the palette
// was "verified (script, not eyeballed)" long before such a script existed;
// this is it, so the claim is now checkable instead of aspirational.
//
// The pair that matters most is the stock badge: its background is a tint of
// its own text colour (StockBadge.tsx), so measuring the colour against a
// bare page — which is what an earlier pass did — reports a contrast the
// user never actually sees.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const CSS = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.css")
const BADGE_TINT = 0.12 // keep in sync with StockBadge.tsx
const AA_SMALL = 4.5
const AA_NON_TEXT = 3 // WCAG 1.4.11, for things like a chart bar on its track
const INSET_STEP = 1.1 // not a WCAG number: the smallest ratio at which the hollow still reads as one

// Each token is declared once as `light-dark(<light>, <dark>)`, so one pass
// over the @theme block yields both palettes.
function parsePalette(css) {
  const themeBlock = css.slice(css.indexOf("@theme"), css.indexOf("\n}", css.indexOf("@theme")))
  const pairs = [
    ...themeBlock.matchAll(/--color-([\w-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi),
  ]
  if (pairs.length === 0) throw new Error("No light-dark() colour tokens found in index.css")
  const light = Object.fromEntries(pairs.map(([, name, value]) => [name, value]))
  const dark = Object.fromEntries(pairs.map(([, name, , value]) => [name, value]))
  return { light, dark }
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(toRgb(a)), luminance(toRgb(b))].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// color-mix(in srgb, colour <pct>%, transparent) composited over a background
function tintOver(colour, background, pct) {
  const [f, b] = [toRgb(colour), toRgb(background)]
  const mixed = f.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)))
  return "#" + mixed.map((v) => v.toString(16).padStart(2, "0")).join("")
}

function checks(p) {
  const onBase = (name) => [
    [`${name} on page`, p[name], p.paper],
    [`${name} on card`, p[name], p.surface],
  ]
  // Inputs, selects and the photo letterbox sit on `inset`: ink is what gets
  // typed there, ink-soft the placeholder, accent the focused border.
  const onInset = (name) => [[`${name} on inset`, p[name], p.inset]]
  return [
    // BarChart draws its fill over a `line` track; nothing here is text.
    ["bar on its track", p["accent-muted"], p.line, AA_NON_TEXT],
    // inset has to stay visibly sunken against a card (that is its whole
    // job); a purely visual step, so it gets a floor, not the text minimum.
    ["inset against card", p.inset, p.surface, INSET_STEP],
    ...onBase("ink"),
    ...onInset("ink"),
    ...onBase("ink-soft"),
    ...onInset("ink-soft"),
    ...onBase("accent"),
    ...onInset("accent"),
    // Bare tone colour (no tint) directly on the page/card — the scarcity
    // copy next to PriceTag, and the error-message pattern used everywhere
    // else in the app, both render this way rather than on a tinted badge.
    ...onBase("stock-good"),
    ...onBase("stock-low"),
    ...onBase("stock-out"),
    // The accent-soft fill carries the active nav pill and row hovers.
    ["ink on accent-soft", p.ink, p["accent-soft"]],
    ["accent on accent-soft", p.accent, p["accent-soft"]],
    // Stock badges: text over a tint of itself, the only honest measurement.
    ...["stock-good", "stock-low", "stock-out"].flatMap((tone) => [
      [`${tone} badge on page`, p[tone], tintOver(p[tone], p.paper, BADGE_TINT)],
      [`${tone} badge on card`, p[tone], tintOver(p[tone], p.surface, BADGE_TINT)],
    ]),
  ]
}

const palette = parsePalette(readFileSync(CSS, "utf8"))
let failed = 0

for (const [mode, p] of Object.entries(palette)) {
  console.log(`\n${mode.toUpperCase()}`)
  for (const [label, fg, bg, min = AA_SMALL] of checks(p)) {
    const ratio = contrast(fg, bg)
    const ok = ratio >= min
    if (!ok) failed++
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below their AA minimum.`)
  process.exit(1)
}
console.log(`\nAll pairs clear AA: ${AA_SMALL}:1 small text, ${AA_NON_TEXT}:1 non-text.`)
