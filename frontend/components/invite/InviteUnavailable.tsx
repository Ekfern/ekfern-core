import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'
import { GUEST_COPY } from '@/lib/invite/lifecycle'

/**
 * What a guest sees once an invitation's link has closed.
 *
 * Deliberately says nothing about the event: no title, image or host, since a
 * closed link can still be forwarded. Neutral paper rather than the brand's
 * colours, and no brand at all when the host has turned branding off.
 */
export default function InviteUnavailable({ showBranding = true }: { showBranding?: boolean }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F6F4F0] px-6 py-16 text-[#2B2722]">
      <div role="status" className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold sm:text-3xl">{GUEST_COPY.archivedTitle}</h1>
        <p className="mt-4 text-base leading-relaxed text-[#5F5850]">{GUEST_COPY.archivedBody}</p>
        {showBranding && (
          <p className="mt-10 text-sm text-[#6F675E]">
            Planning something of your own?{' '}
            <a href={COMPANY_HOMEPAGE} className="font-medium underline underline-offset-4 text-[#2B2722]">
              Make an invitation with {BRAND_NAME}
            </a>
          </p>
        )}
      </div>
    </main>
  )
}
