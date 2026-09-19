import type { RecognitionResult as RecognitionResultType } from "../../api/recognition"
import { formatPrice } from "../../lib/currency"
import { StockBadge } from "../products/StockBadge"

interface RecognitionResultProps {
  result: RecognitionResultType
}

const MATCH_TYPE_LABEL: Record<"barcode" | "similarity", string> = {
  barcode: "Código de barras",
  similarity: "Por similitud visual",
}

export function RecognitionResult({ result }: RecognitionResultProps) {
  if (result.match_type === "not_found") {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-widest text-ink-soft">Sin coincidencia</p>
        <p className="mt-2 text-sm text-ink">{result.reason}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-4">
        <img
          src={result.thumbnail_url ?? result.image_url}
          alt=""
          className="h-20 w-20 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            {MATCH_TYPE_LABEL[result.match_type]}
            {result.confidence != null && ` · ${(result.confidence * 100).toFixed(0)}% de confianza`}
            {result.matched_images != null &&
              result.total_images != null &&
              result.total_images > 1 &&
              ` · ${result.matched_images} de ${result.total_images} fotos coinciden`}
          </p>
          {result.name && <p className="mt-1 truncate text-base font-semibold text-ink">{result.name}</p>}
          <p className={result.name ? "mt-0.5 text-sm text-ink-soft" : "mt-1 text-base font-semibold text-ink"}>
            {result.description}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-lg font-semibold tabular-nums text-ink">{formatPrice(result.price)}</span>
            <StockBadge stock={result.stock} />
          </div>
        </div>
      </div>
    </div>
  )
}
