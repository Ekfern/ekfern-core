import React from 'react'

interface SettingsSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  /** Small status pill beside the title, e.g. "Using default". */
  badge?: React.ReactNode
  /** One line under the title saying what the section is for. */
  description?: React.ReactNode
  /**
   * Keep the body in the DOM while collapsed. Page Background needs this: its
   * controls hold local state that must survive the section closing.
   */
  keepMounted?: boolean
  children: React.ReactNode
}

/**
 * One collapsible section of a settings panel - Page Background, Invite
 * Animations, Look & Style, Link Preview.
 *
 * Each of those used to draw its own header, and two recipes ended up side by
 * side: a `font-medium` span with a 16px chevron, and a `font-semibold` h3 with
 * a 20px chevron inside a `p-2 -m-2` button - the negative margin moved the
 * button left without widening it, so its chevron sat 16px inside the others.
 * The header lives here so every section is the same shape, including ones not
 * written yet.
 *
 * The divider is the section's own top border, dropped on the first section in
 * its list.
 */
export default function SettingsSection({
  title,
  open,
  onToggle,
  badge,
  description,
  keepMounted = false,
  children,
}: SettingsSectionProps) {
  const body = <div className={`mt-4 ${open ? '' : 'hidden'}`}>{children}</div>

  return (
    <section className="border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
      <h3 className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-start justify-between gap-3 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green rounded-md"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-eco-green">{title}</span>
              {badge}
            </span>
            {description && <span className="block text-xs text-gray-500 mt-0.5">{description}</span>}
          </span>
          <svg
            aria-hidden
            className={`w-4 h-4 mt-0.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </h3>
      {(open || keepMounted) && body}
    </section>
  )
}
