interface ScoreCardProps {
  score: number
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: 'text-dedsec-green', glow: 'glow-green', label: 'SECURE' }
  if (score >= 60) return { text: 'text-yellow-400', glow: '', label: 'MODERATE' }
  if (score >= 40) return { text: 'text-orange-400', glow: '', label: 'VULNERABLE' }
  return { text: 'text-dedsec-red', glow: 'glow-red', label: 'CRITICAL' }
}

export default function ScoreCard({ score }: ScoreCardProps) {
  const { text, glow, label } = getScoreColor(score)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1f1f1f" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${text} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${text} ${glow}`}>{score}</span>
          <span className="text-dedsec-muted text-xs">/100</span>
        </div>
      </div>
      <span className={`mt-2 text-xs font-bold tracking-widest ${text}`}>{label}</span>
    </div>
  )
}