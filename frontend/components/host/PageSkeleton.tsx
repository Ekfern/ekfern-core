/**
 * What a host page looks like while its data is on the way.
 *
 * Pages used to swap the whole screen for a centred "Loading..." and then pop
 * the page in, which read as a flicker on every click. A skeleton keeps the
 * page's own frame - same width, same spacing, same blocks - so the content
 * fills in where it will be rather than appearing from nowhere, and a page
 * transition has something real to slide in.
 *
 * Each shape mirrors its page's layout (container width and padding), so
 * nothing jumps when the data lands. The shimmer stops for anyone who asked
 * for less motion; screen readers hear "Loading" once.
 */

type Shape = 'overview' | 'list' | 'form' | 'grid' | 'editor'

interface Props {
  shape: Shape
  /** form only: the page's max width. */
  width?: '2xl' | '4xl'
}

/** One grey placeholder block. */
export function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-eco-green/10 motion-safe:animate-pulse ${className}`} />
}

function Card({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-lg border-2 border-eco-green-light bg-white p-6 ${className}`}>
      <Bone className="h-5 w-40 mb-5" />
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Bone key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

function Heading({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="mb-6 space-y-3">
      <Bone className="h-8 w-56 md:h-9 md:w-72" />
      {subtitle && <Bone className="h-4 w-72 max-w-full" />}
    </div>
  )
}

export default function PageSkeleton({ shape, width = '4xl' }: Props) {
  return (
    <div role="status" aria-busy="true" className="min-h-screen bg-eco-beige">
      <span className="sr-only">Loading…</span>
      {shape === 'overview' && (
        <div className="container mx-auto px-4 py-6 md:py-8">
          <Heading />
          <div className="mb-6 flex gap-3">
            <Bone className="h-6 w-24 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-lg border-2 border-eco-green-light bg-white p-4">
                <Bone className="h-3 w-16 mb-3" />
                <Bone className="h-7 w-12" />
              </div>
            ))}
          </div>
          <Card lines={4} className="mb-8" />
          <Card lines={3} />
        </div>
      )}

      {shape === 'list' && (
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <Heading />
            <div className="flex gap-2">
              <Bone className="h-10 w-32" />
              <Bone className="h-10 w-28" />
            </div>
          </div>
          <Bone className="mb-4 h-10 w-full" />
          <div className="rounded-lg border-2 border-eco-green-light bg-white">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0">
                <Bone className="h-4 w-4" />
                <Bone className="h-4 w-1/4" />
                <Bone className="h-4 w-1/5" />
                <Bone className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {shape === 'form' && (
        <div className={`mx-auto px-4 py-8 ${width === '2xl' ? 'max-w-2xl' : 'max-w-4xl'}`}>
          <Heading />
          <div className="space-y-6">
            <Card lines={3} />
            <Card lines={4} />
            <Card lines={2} />
          </div>
        </div>
      )}

      {shape === 'grid' && (
        <div className="p-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex gap-2">
              <Bone className="h-8 w-28" />
              <Bone className="h-8 w-20" />
            </div>
            <Heading />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Card key={i} lines={3} />
              ))}
            </div>
          </div>
        </div>
      )}

      {shape === 'editor' && (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <Bone className="h-8 w-48" />
            <div className="flex gap-2">
              <Bone className="h-9 w-24" />
              <Bone className="h-9 w-24" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border-2 border-eco-green-light bg-white p-4">
                  <Bone className="h-5 w-5" />
                  <Bone className="h-4 w-1/3" />
                  <Bone className="ml-auto h-5 w-10 rounded-full" />
                </div>
              ))}
            </div>
            {/* The phone preview's frame, so the page does not reflow when it arrives. */}
            <div className="hidden lg:block">
              <Bone className="mx-auto h-[640px] w-[320px] rounded-[2.5rem]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
