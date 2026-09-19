import { CARD_BODY_CLASS, CARD_CLASS, CARD_MEDIA_PORTRAIT_CLASS } from "./cardStyles"
import { CATALOG_GRID_CLASS } from "./ProductCatalog"

const PLACEHOLDER_COUNT = 8
const CIRCLE_COUNT = 5

const BLOCK_CLASS = "rounded bg-line"

/** Mirrors the home's ready layout block for block — hero, stats strip,
 * category circles, then the grid at the card's real 4:5 ratio. When the
 * skeleton and the page drifted apart before, the whole page visibly
 * jumped as the real data replaced this; now there is more page above the
 * grid to get wrong, so all of it is placeholdered. */
export function CatalogSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-10 sm:gap-14" aria-hidden="true">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div className="order-2 lg:order-1">
          <div className={`${BLOCK_CLASS} h-3 w-28`} />
          <div className={`${BLOCK_CLASS} mt-4 h-10 w-3/4 sm:h-12`} />
          <div className={`${BLOCK_CLASS} mt-3 h-10 w-1/2 sm:h-12`} />
          <div className={`${BLOCK_CLASS} mt-5 h-4 w-full max-w-prose`} />
          <div className={`${BLOCK_CLASS} mt-2 h-4 w-2/3`} />
          <div className="mt-6 flex gap-3">
            <div className={`${BLOCK_CLASS} h-11 w-32 rounded-full`} />
            <div className={`${BLOCK_CLASS} h-11 w-52 rounded-full`} />
          </div>
        </div>
        <div className="order-1 aspect-[4/5] rounded-2xl bg-line lg:order-2" />
      </div>

      <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center gap-2 px-2 py-4 sm:py-5">
            <div className={`${BLOCK_CLASS} h-7 w-10 sm:h-8`} />
            <div className={`${BLOCK_CLASS} h-3 w-16`} />
          </div>
        ))}
      </div>

      <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:justify-center sm:gap-5 sm:px-0">
        {Array.from({ length: CIRCLE_COUNT }).map((_, index) => (
          <div key={index} className="flex w-24 shrink-0 flex-col items-center gap-2 sm:w-28">
            <div className="h-18 w-18 rounded-full bg-line sm:h-24 sm:w-24" />
            <div className={`${BLOCK_CLASS} h-3 w-12`} />
          </div>
        ))}
      </div>

      <ul className={CATALOG_GRID_CLASS}>
        {Array.from({ length: PLACEHOLDER_COUNT }).map((_, index) => (
          <li key={index}>
            <div className={`${CARD_CLASS} h-full`}>
              <div className={`${CARD_MEDIA_PORTRAIT_CLASS} bg-line`} />
              <div className={CARD_BODY_CLASS}>
                <div className={`${BLOCK_CLASS} h-3 w-full`} />
                <div className={`${BLOCK_CLASS} mt-1 h-4 w-1/2`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
