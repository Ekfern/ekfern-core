type InvitePublishStatus = 'Published' | 'Draft' | 'Not created' | 'Unknown'

interface EventStatusBadgeProps {
  status: InvitePublishStatus
  isPublic: boolean
  isExpired?: boolean
}

export default function EventStatusBadge({ status, isPublic, isExpired }: EventStatusBadgeProps) {
  const getStatusConfig = () => {
    if (isExpired) {
      return { dot: 'bg-gray-400', label: 'Expired', textColor: 'text-gray-500' }
    }
    switch (status) {
      case 'Published':
        return { dot: 'bg-green-500 animate-pulse', label: 'Live', textColor: 'text-green-700' }
      case 'Draft':
        return { dot: 'bg-amber-400', label: 'Draft', textColor: 'text-amber-700' }
      case 'Not created':
        return { dot: 'bg-gray-300', label: 'Not configured', textColor: 'text-gray-500' }
      default:
        return { dot: 'bg-gray-300', label: 'Unknown', textColor: 'text-gray-500' }
    }
  }

  const { dot, label, textColor } = getStatusConfig()

  return (
    <div className="flex items-center gap-3">
      <span className={`flex items-center gap-1.5 text-sm font-medium ${textColor}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="text-gray-300">·</span>
      <span className="text-sm text-gray-500">
        {isPublic ? 'Public' : 'Private'}
      </span>
    </div>
  )
}
