/** Read-only star bar; supports fractional averages. */
export function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(5, value)) * 20
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5`}>
      <span className="stars-bg">★★★★★</span>
      <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  )
}

/** Aerelle mark: an open ring (pilates ring / halo) with a floating dot. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6f5ff" />
          <stop offset="1" stopColor="#86c9f3" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lg-a)" />
      <path d="M28.5 25.5a10 10 0 1 1 0-11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="29.5" cy="20" r="2.6" fill="#fff" />
    </svg>
  )
}

/** "Alex Morgan" -> "AM" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
