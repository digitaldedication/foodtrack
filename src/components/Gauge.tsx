interface Props {
  eaten: number
  goal: number
}

/**
 * Halfronde kcal-meter met gradientvulling. Kleurt rood zodra het doel is
 * overschreden.
 */
export default function Gauge({ eaten, goal }: Props) {
  const remaining = Math.round(goal - eaten)
  const frac = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const over = remaining < 0

  const r = 92
  const cx = 110
  const cy = 106
  const circumference = Math.PI * r
  const dash = frac * circumference

  return (
    <div className="gauge-wrap">
      <svg width="220" height="120" viewBox="0 0 220 120" role="img" aria-label={`${Math.round(eaten)} van ${goal} kcal`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--groen)" />
            <stop offset="100%" stopColor="var(--groen-fel)" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--groen-zacht)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={over ? 'var(--danger)' : 'url(#gaugeGrad)'}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* doelmarkering aan het einde van de boog */}
        <circle cx={cx + r} cy={cy} r="3.5" fill="var(--ink-soft)" opacity="0.5" />
      </svg>
      <div className={`gauge-number${over ? ' over' : ''}`}>{Math.abs(remaining)}</div>
      <div className="gauge-label">{over ? 'kcal over je doel' : 'kcal te gaan'}</div>
      <div className="gauge-sub">
        {Math.round(eaten)} gegeten · doel {goal}
      </div>
    </div>
  )
}
