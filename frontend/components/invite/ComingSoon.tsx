import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'

interface ComingSoonProps {
  /** Optional event title to personalize the message. */
  title?: string
  /** When false, the EkFern branding/footer link is hidden (white-label events). */
  showBranding?: boolean
  /** Override the homepage link target. */
  homeUrl?: string
}

/**
 * Branded placeholder shown to guests when an invite page exists but is currently
 * pulled back (unpublished). Replaces the old hard 404 so a host can pause an invite
 * without guests hitting a broken page, and so the page flips back to live automatically
 * once the host re-publishes.
 */
export default function ComingSoon({ title, showBranding = true, homeUrl }: ComingSoonProps) {
  const home = homeUrl || COMPANY_HOMEPAGE

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F7F1E7] to-[#E8D8C3] px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-white/70 shadow-sm">
          <svg className="h-8 w-8 text-[#0B3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-7Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m4 8 8 6 8-6" />
          </svg>
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9C7A3C]">
          Coming soon
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[#0B3D2E] sm:text-4xl">
          {title ? title : 'This invitation is on its way'}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#5b5346]">
          The host is putting the finishing touches on this page. Please check back a little later —
          it will be here soon.
        </p>

        {showBranding && (
          <div className="mt-10">
            <a
              href={home}
              className="inline-flex items-center gap-2 rounded-full bg-[#0B3D2E] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a3326]"
            >
              Visit {BRAND_NAME}
              <span aria-hidden>&#8594;</span>
            </a>
            <p className="mt-6 text-xs text-[#9a9081]">
              Powered by {BRAND_NAME}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
