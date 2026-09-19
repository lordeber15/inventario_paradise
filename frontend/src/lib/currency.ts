const formatter = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })

/** Formats an amount as Peruvian soles: 1250.5 -> "S/ 1,250.50".
 *
 * Intl separates the "S/" symbol from the amount with a non-breaking space
 * (U+00A0). It's normalized to a plain space so the rendered DOM matches what
 * tests and copy-paste expect, without giving up Intl's thousands separators. */
export function formatPrice(value: number): string {
  return formatter.format(value).replace(/ /g, " ")
}
