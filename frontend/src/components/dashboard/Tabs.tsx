import { useId, useRef, useState } from "react"

export interface TabDefinition {
  id: string
  label: string
  render: () => React.ReactNode
}

interface TabsProps {
  tabs: TabDefinition[]
}

/** El primer patrón de pestañas del proyecto. Existe para que los tres
 * desgloses del dashboard (método de pago, vendedor, top productos) ocupen una
 * tarjeta de alto acotado en vez de tres apiladas: en celular la de vendedores
 * sola medía más que la pantalla entera.
 *
 * Teclado: las flechas mueven el foco Y la selección, que es el comportamiento
 * esperado de un tablist de selección automática — cambiar de pestaña acá no
 * cuesta nada (los datos ya están en memoria), así que no hace falta el paso
 * extra de confirmar con Enter. */
export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activeIndex = tabs.findIndex((tab) => tab.id === activeId)
  const active = tabs[activeIndex] ?? tabs[0]
  if (!active) return null

  function selectByIndex(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length]
    setActiveId(next.id)
    tabRefs.current[next.id]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") selectByIndex(activeIndex + 1)
    else if (event.key === "ArrowLeft") selectByIndex(activeIndex - 1)
    else if (event.key === "Home") selectByIndex(0)
    else if (event.key === "End") selectByIndex(tabs.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div
        role="tablist"
        aria-label="Desglose de ventas"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line p-2"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selected ? "bg-accent-soft text-accent" : "text-ink-soft"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="p-4"
      >
        {active.render()}
      </div>
    </div>
  )
}
