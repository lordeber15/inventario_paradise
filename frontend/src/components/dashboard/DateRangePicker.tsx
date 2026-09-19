interface DateRangePickerProps {
  desde: string
  hasta: string
  onChange: (desde: string, hasta: string) => void
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Hoy", days: 0 },
  { label: "7 días", days: 6 },
  { label: "30 días", days: 29 },
]

export function DateRangePicker({ desde, hasta, onChange }: DateRangePickerProps) {
  function applyPreset(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    onChange(isoDate(start), isoDate(end))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => applyPreset(preset.days)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-transform hover:border-accent active:scale-95"
        >
          {preset.label}
        </button>
      ))}
      <input
        type="date"
        value={desde}
        max={hasta}
        onChange={(event) => onChange(event.target.value, hasta)}
        className="rounded-lg border border-line bg-inset px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
      />
      <span className="text-xs text-ink-soft">a</span>
      <input
        type="date"
        value={hasta}
        min={desde}
        onChange={(event) => onChange(desde, event.target.value)}
        className="rounded-lg border border-line bg-inset px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
      />
    </div>
  )
}
