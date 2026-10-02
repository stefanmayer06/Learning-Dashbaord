/** Progress bar and ring (MOOC-style). Fractions are 0..1. */

export function ProgressBar({ value, label, thin }: { value: number; label?: string; thin?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <span
      className={`progress${thin ? ' progress-thin' : ''}${pct >= 100 ? ' complete' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? 'Progress'}
    >
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

export function ProgressRing({ value, size = 44, stroke = 4, label, showText = true }: { value: number; size?: number; stroke?: number; label?: string; showText?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span
      className={`ring${pct >= 100 ? ' complete' : ''}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? 'Progress'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      {showText && (
        <span className="ring-text" style={{ fontSize: size < 40 ? (pct >= 100 ? 8.5 : 10) : size > 64 ? 16 : 12 }}>
          {pct}%
        </span>
      )}
    </span>
  )
}
