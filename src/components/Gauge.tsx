interface Props {
  eaten: number
  goal: number
}

/**
 * Semicircular kcal gauge: the arc fills as the day fills up. Turns red once
 * the goal is exceeded.
 */
export default function Gauge({ eaten, goal }: Props) {
  const remaining = Math.round(goal - eaten)
  const frac = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const over = remaining < 0

  const r = 92
  const cx = 110
  const cy = 104
  const circumference = Math.PI * r
  const dash = frac * circumference

  return (
    <div className="gauge-wrap">
      <svg width="220" height="118" viewBox="0 0 220 118" role="img" aria-label={`${Math.round(eaten)} van ${goal} kcal`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--groen-zacht)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={over ? 'var(--danger)' : 'var(--groen)'}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className={`gauge-number${over ? ' over' : ''}`}>{Math.abs(remaining)}</div>
      <div className="gauge-label">{over ? 'kcal over je doel' : 'kcal te gaan'}</div>
      <div className="gauge-sub">
        {Math.round(eaten)} gegeten · doel {goal}
      </div>
    </div>
  )
}
