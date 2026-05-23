interface ResponseRateRingProps {
  responded: number
  total: number
  size?: number
}

export default function ResponseRateRing({ responded, total, size = 120 }: ResponseRateRingProps) {
  const radius = 15.9
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? Math.round((responded / total) * 100) : 0
  // strokeDasharray uses a 100-unit scale mapped to circumference
  const arc = (pct / 100) * circumference
  const gap = circumference - arc

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        aria-label={`${responded} of ${total} guests responded`}
      >
        {/* Background track */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#C8B8A2"
          strokeWidth="3"
        />
        {/* Progress arc */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#0B3D2E"
          strokeWidth="3"
          strokeDasharray={`${arc} ${gap}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
        {/* Center percentage */}
        <text
          x="18"
          y="16"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="6"
          fontWeight="700"
          fill="#0B3D2E"
          fontFamily="Inter, Arial, sans-serif"
        >
          {pct}%
        </text>
        {/* Center sub-label */}
        <text
          x="18"
          y="21.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="2.8"
          fill="#6B7280"
          fontFamily="Inter, Arial, sans-serif"
        >
          responded
        </text>
      </svg>

      <div className="text-center">
        <p className="text-sm font-semibold text-eco-green">
          {responded} <span className="text-gray-400 font-normal">of</span> {total}
        </p>
        <p className="text-xs text-gray-500">guests responded</p>
      </div>
    </div>
  )
}
