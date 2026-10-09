'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { Link as TransitionLink } from 'next-view-transitions'
import { navDirection } from '@/lib/host/navDirection'

type Props = React.ComponentProps<typeof NextLink>

/**
 * A host navigation link that animates only when the move has a direction.
 *
 * Going deeper or coming back slides (a view transition). Moving between an
 * event's tabs does not animate at all, as a phone's tab bar does not: a view
 * transition holds the old page frozen until the new one exists, then
 * cross-fades the two pictures, so a tab switch showed the previous page
 * behind the next one. A plain link shows the new page, or its skeleton, the
 * moment it is ready.
 */
export default function HostLink(props: Props) {
  const pathname = usePathname()
  const target = typeof props.href === 'string' ? props.href : props.href.pathname ?? ''
  return navDirection(pathname, target) === 'tab' ? <NextLink {...props} /> : <TransitionLink {...props} />
}
