import type { Metadata } from 'next'
import HostShell from '@/components/host/HostShell'

/**
 * Always render host pages on request. Next.js pre-renders static pages and
 * marks them cacheable for a year (s-maxage=31536000), overriding the no-cache
 * header next.config.js sets for /host/*. CloudFront then kept serving old HTML
 * after deploys, pointing at the previous build's JS and CSS - the stuck,
 * unstyled "Loading..." screen. Dynamic rendering sends no-store instead.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
}

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>
}

