import React from 'react'

interface ConfidenceBadgeProps {
  confidence: number // 0 to 1
  label?: string
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, label = 'Confidence' }) => {
  const pct = Math.round(confidence * 100)

  let colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300'
  let dotColor = 'bg-emerald-500'
  let note = ''

  if (confidence >= 0.85) {
    colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300'
    dotColor = 'bg-emerald-500'
  } else if (confidence >= 0.70) {
    colorStyle = 'bg-amber-50 text-amber-800 border-amber-300'
    dotColor = 'bg-amber-500'
  } else {
    colorStyle = 'bg-rose-50 text-rose-800 border-rose-300'
    dotColor = 'bg-rose-500'
    note = '— Review carefully'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorStyle}`}
      title={`${label}: ${pct}%`}
    >
      <span className={`w-2 h-2 rounded-full mr-1.5 ${dotColor}`} />
      <span>
        {label} {pct}% {note}
      </span>
    </span>
  )
}
