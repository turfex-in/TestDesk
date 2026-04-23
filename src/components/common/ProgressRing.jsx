export default function ProgressRing({
  size = 56,
  strokeWidth = 6,
  progress = 0,
  passed = 0,
  failed = 0,
  showLabel = true,
  label,
  tone = 'primary',
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r

  // If pass/fail provided, split into two arcs. Otherwise single progress.
  const total = passed + failed || 1
  const passArc = (Math.min(100, Math.max(0, passed)) / total) * 100
  const failArc = (Math.min(100, Math.max(0, failed)) / total) * 100

  const pct = Math.max(0, Math.min(100, progress))
  const singleDash = (c * pct) / 100

  const toneStroke =
    tone === 'secondary'
      ? '#4edea3'
      : tone === 'danger'
      ? '#ffb4ab'
      : tone === 'tertiary'
      ? '#ffb783'
      : '#c0c1ff'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="#2d2d38" strokeWidth={strokeWidth} />
        {passed + failed > 0 ? (
          <>
            {/* passed arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="transparent"
              stroke="#4edea3"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(c * passArc) / 100} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            {/* failed arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="transparent"
              stroke="#ffb4ab"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(c * failArc) / 100} ${c}`}
              strokeDashoffset={-(c * passArc) / 100}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </>
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="transparent"
            stroke={toneStroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${singleDash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold">
          {label ?? `${Math.round(pct)}%`}
        </div>
      )}
    </div>
  )
}
