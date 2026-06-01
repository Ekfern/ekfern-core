'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Sparkles, BarChart3, Filter } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { fuzzyFilter } from '@/lib/fuzzyFilter'
import {
  getInvitePageLayoutsForStudio,
  type InvitePageLayoutResponse,
} from '@/lib/invite/api'
import { logError } from '@/lib/error-handler'
import StudioLayoutPreviewCell from '@/components/invite/StudioLayoutPreviewCell'

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
  is_superuser?: boolean
  llm_module_access?: boolean
}

export default function PageLayoutStudioListPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const designCodeRaw = searchParams.get('design_code')
  /** Canonical filter from URL (Save-for-review navigates here with ?design_code=…) */
  const designCodeFilter = useMemo(() => (designCodeRaw ?? '').trim(), [designCodeRaw])
  const [layouts, setLayouts] = useState<InvitePageLayoutResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  const [canUseLlm, setCanUseLlm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [designCodeInput, setDesignCodeInput] = useState('')

  const syncUrlDesignParam = useCallback(
    (value: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      const v = value.trim()
      if (v) sp.set('design_code', v)
      else sp.delete('design_code')
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    setDesignCodeInput(designCodeFilter)
  }, [designCodeFilter])

  const filteredLayouts = useMemo(
    () =>
      fuzzyFilter(layouts, searchQuery, [
        'name',
        'description',
        'preview_alt',
        'created_by_name',
        'visibility',
        'status',
      ]),
    [layouts, searchQuery]
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      if (!token) {
        router.push('/host/login')
        return
      }
      setLoading(true)
      try {
        const meRes = await api.get<MeResponse>('/api/auth/me/')
        if (cancelled) return
        const staff = meRes.data?.is_staff === true
        setIsStaff(staff)
        const me = meRes.data
        setCanUseLlm(me?.is_superuser === true || me?.llm_module_access === true)
        if (!staff) {
          router.push('/host/dashboard')
          return
        }
        const list = await getInvitePageLayoutsForStudio({
          designCode: designCodeFilter || undefined,
        })
        if (cancelled) return
        setLayouts(list)
      } catch (e: any) {
        if (cancelled) return
        logError('Page Layout Studio list failed', e)
        if (e?.response?.status === 401) {
          router.push('/host/login')
          return
        }
        if (e?.response?.status === 403) {
          router.push('/host/dashboard')
          return
        }
        setLayouts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [router, designCodeFilter])

  const applyDesignCodeFilter = () => {
    const v = designCodeInput.trim()
    syncUrlDesignParam(v)
  }

  const clearDesignCodeFilter = () => {
    setDesignCodeInput('')
    syncUrlDesignParam('')
  }

  if (loading || isStaff === null) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">Page Layout Studio</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Design invite page layouts for the host library. Only staff can access this page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canUseLlm && (
              <Link href="/host/templates/layouts/llm-usage">
                <Button variant="outline" className="gap-2">
                  <BarChart3 size={16} />
                  LLM Usage
                </Button>
              </Link>
            )}
            {canUseLlm && (
              <Link href="/host/templates/layouts/generate">
                <Button variant="outline" className="gap-2 border-eco-green text-eco-green hover:bg-eco-green-light">
                  <Sparkles size={16} />
                  Generate with AI
                </Button>
              </Link>
            )}
            <Link href="/host/page-layouts/new">
              <Button className="bg-eco-green hover:bg-eco-green-dark text-white">New page layout</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Page Layouts</CardTitle>
            <CardDescription>
              All invite page layouts. Filter by design code to see only the layouts linked to that
              design (same code used when saving AI previews for review).
              {designCodeFilter ? (
                <span className="block mt-2 text-eco-green font-medium">
                  You opened this list with a design filter — only layouts linked to design{' '}
                  <strong>{designCodeFilter}</strong> are loaded from the server (plus your text search below).
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search page layouts (typos OK)"
                  className="pl-9"
                  aria-label="Search page layouts"
                  disabled={layouts.length === 0 && !designCodeFilter}
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 min-w-[min(100%,280px)] flex-1 max-w-xl">
                  <label htmlFor="studio-design-code-filter" className="text-xs text-gray-600 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Design code
                  </label>
                  <Input
                    id="studio-design-code-filter"
                    type="text"
                    value={designCodeInput}
                    onChange={(e) => setDesignCodeInput(e.target.value)}
                    placeholder="e.g. DSGN-0042"
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="button" onClick={applyDesignCodeFilter}>
                  Apply filter
                </Button>
                {designCodeFilter ? (
                  <Button type="button" variant="outline" onClick={clearDesignCodeFilter}>
                    Clear
                  </Button>
                ) : null}
              </div>
              {designCodeFilter ? (
                <p className="text-xs text-gray-600 max-w-xl">
                  Showing layouts linked to design <strong>{designCodeFilter}</strong>. Layouts created
                  for a different design will not appear unless re-linked.
                </p>
              ) : null}
            </div>
            {!loading && layouts.length === 0 && !designCodeFilter ? (
              <p className="text-gray-500 py-8 text-center">
                No layouts yet. Create one with &quot;New page layout&quot;.
              </p>
            ) : !loading && layouts.length === 0 && designCodeFilter ? (
              <p className="text-gray-500 py-8 text-center">
                No layouts linked to design {designCodeFilter}. Generate layouts for this design, or
                clear the filter to see everything.
              </p>
            ) : filteredLayouts.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No page layouts match your search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Preview</th>
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Visibility</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Creator</th>
                      <th className="pb-2 pr-4 font-medium">Updated</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLayouts.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-3 pr-4 align-top">
                          <StudioLayoutPreviewCell layout={t} />
                        </td>
                        <td className="py-3 pr-4 font-medium">{t.name}</td>
                        <td className="py-3 pr-4">
                          <Badge>{t.visibility ?? 'public'}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={t.status === 'published' ? 'default' : undefined}>
                            {t.status ?? 'draft'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{t.created_by_name ?? '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {t.updated_at
                            ? new Date(t.updated_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/host/page-layouts/${t.id}/preview`}>
                              <Button variant="outline" size="sm">
                                Preview
                              </Button>
                            </Link>
                            <Link href={`/host/page-layouts/${t.id}/edit`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <Link href="/host/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
