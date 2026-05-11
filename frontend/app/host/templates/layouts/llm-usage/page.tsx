'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLLMUsageSummary, type LLMUsageSummary } from '@/lib/invite/auto-generator-api'
import { logError } from '@/lib/error-handler'

interface MeResponse {
  id: number
  is_superuser?: boolean
}

function ProgressBar({ pct, threshold }: { pct: number; threshold: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const color = clamped >= 100 ? 'bg-red-500' : clamped >= threshold ? 'bg-amber-500' : 'bg-eco-green'
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

function DailyChart({ rows }: { rows: Array<{ day: string; cost_usd: number }> }) {
  if (!rows.length) {
    return <p className="text-xs text-gray-500">No spend recorded in this window.</p>
  }
  const max = Math.max(0.0001, ...rows.map((r) => r.cost_usd))
  return (
    <div className="flex items-end gap-1 h-32">
      {rows.map((r) => {
        const pct = (r.cost_usd / max) * 100
        return (
          <div
            key={r.day}
            className="flex-1 bg-eco-green/70 hover:bg-eco-green relative group rounded-t"
            style={{ height: `${Math.max(2, pct)}%` }}
            title={`${r.day} \u00b7 $${r.cost_usd.toFixed(4)}`}
          />
        )
      })}
    </div>
  )
}

export default function LLMUsageDashboardPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [usage, setUsage] = useState<LLMUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [days, setDays] = useState(30)

  const load = async () => {
    setRefreshing(true)
    try {
      const summary = await getLLMUsageSummary(days)
      setUsage(summary)
      setError(null)
    } catch (err: any) {
      logError('LLM usage summary failed', err)
      setError(err?.response?.data?.error || 'Could not load usage summary.')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) {
      router.push('/host/login')
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const meRes = await api.get<MeResponse>('/api/auth/me/')
        if (cancelled) return
        if (!meRes.data?.is_superuser) {
          router.push('/host/dashboard')
          return
        }
        setAllowed(true)
        await load()
      } catch (err: any) {
        if (cancelled) return
        if (err?.response?.status === 401) router.push('/host/login')
        else router.push('/host/dashboard')
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Reload when days changes (after initial mount).
  useEffect(() => {
    if (allowed) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  if (!authChecked || !allowed) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Checking permissions\u2026</p>
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">{error ?? 'Loading\u2026'}</p>
      </div>
    )
  }

  const threshold = usage.alert_threshold_pct

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">LLM Cost Dashboard</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Live spend, caps, and recent calls for the Page Layout Auto-Generator.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button variant="outline" onClick={load} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/host/templates/layouts/generate">
              <Button className="bg-eco-green hover:bg-green-600 text-white">Generate</Button>
            </Link>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {/* Status row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <Badge variant={usage.kill_switch_enabled ? 'success' : 'warning'}>
                {usage.kill_switch_enabled ? 'Kill-switch ON' : 'Kill-switch OFF'}
              </Badge>
              <p className="text-xs text-gray-600 mt-2">
                API key: {usage.api_key_configured ? 'configured' : <span className="text-red-700">missing</span>}
              </p>
              <p className="text-xs text-gray-600">Vision: {usage.models.vision}</p>
              <p className="text-xs text-gray-600">Text: {usage.models.text}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500 mb-1">Today</p>
              <p className="text-lg font-semibold">
                ${usage.daily.spend_usd.toFixed(4)}
                <span className="text-xs text-gray-500 font-normal"> / ${usage.daily.cap_usd.toFixed(2)}</span>
              </p>
              <ProgressBar pct={usage.daily.pct} threshold={threshold} />
              <p className="text-xs text-gray-500 mt-1">{usage.daily.pct}% of daily cap</p>
              {usage.daily.pct >= threshold && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Above {threshold}% threshold
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500 mb-1">This month</p>
              <p className="text-lg font-semibold">
                ${usage.monthly.spend_usd.toFixed(4)}
                <span className="text-xs text-gray-500 font-normal"> / ${usage.monthly.cap_usd.toFixed(2)}</span>
              </p>
              <ProgressBar pct={usage.monthly.pct} threshold={threshold} />
              <p className="text-xs text-gray-500 mt-1">{usage.monthly.pct}% of monthly cap</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Daily spend</CardTitle>
            <CardDescription>Successful, non-cached LLM calls over the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart rows={usage.daily_breakdown} />
          </CardContent>
        </Card>

        {usage.health && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Pipeline health</CardTitle>
              <CardDescription>
                Last {usage.health.window_days} day(s). p50/p95 latency,
                error rate, and vision cache hit rate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border rounded-md p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Vision
                  </div>
                  <div className="text-sm font-medium">
                    {usage.health.vision.total} calls
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Cache hit: <span className="font-mono">{usage.health.vision.cache_hit_pct}%</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Error rate:{' '}
                    <span className={`font-mono ${usage.health.vision.error_rate_pct > 5 ? 'text-red-600' : ''}`}>
                      {usage.health.vision.error_rate_pct}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    p50 / p95:{' '}
                    <span className="font-mono">
                      {usage.health.vision.p50_ms}ms / {usage.health.vision.p95_ms}ms
                    </span>
                  </div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Text
                  </div>
                  <div className="text-sm font-medium">
                    {usage.health.text.total} calls
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Cache hit: <span className="font-mono">{usage.health.text.cache_hit_pct}%</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Error rate:{' '}
                    <span className={`font-mono ${usage.health.text.error_rate_pct > 5 ? 'text-red-600' : ''}`}>
                      {usage.health.text.error_rate_pct}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    p50 / p95:{' '}
                    <span className="font-mono">
                      {usage.health.text.p50_ms}ms / {usage.health.text.p95_ms}ms
                    </span>
                  </div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Generations
                  </div>
                  <div className="text-sm font-medium">
                    {usage.health.generations.count} sessions
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Sessions over last {usage.health.window_days} day(s).
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Fallback %, generation latency p50/p95 are emitted as
                    structured logs (METRIC layout_generator.generate);
                    surface them via your log pipeline.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top spenders */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top spenders</CardTitle>
            <CardDescription>By user ID, in the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.top_spenders.length === 0 ? (
              <p className="text-sm text-gray-500">No spend recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 font-medium">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.top_spenders.map((s) => (
                    <tr key={s.user_id} className="border-b">
                      <td className="py-2 pr-4">User #{s.user_id}</td>
                      <td className="py-2 font-mono">${s.cost_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Recent calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent LLM calls</CardTitle>
            <CardDescription>Last 50 calls. Cached calls show as $0.</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.recent_calls.length === 0 ? (
              <p className="text-sm text-gray-500">No calls yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-3 font-medium">When</th>
                      <th className="pb-2 pr-3 font-medium">User</th>
                      <th className="pb-2 pr-3 font-medium">Op</th>
                      <th className="pb-2 pr-3 font-medium">Model</th>
                      <th className="pb-2 pr-3 font-medium">In/Out tokens</th>
                      <th className="pb-2 pr-3 font-medium">Cost</th>
                      <th className="pb-2 pr-3 font-medium">Cache</th>
                      <th className="pb-2 pr-3 font-medium">Result</th>
                      <th className="pb-2 font-medium">Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent_calls.map((c) => (
                      <tr key={c.id} className="border-b">
                        <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">
                          {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-1.5 pr-3">{c.user_id ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.operation}</td>
                        <td className="py-1.5 pr-3">{c.model}</td>
                        <td className="py-1.5 pr-3 font-mono">{c.input_tokens}/{c.output_tokens}</td>
                        <td className="py-1.5 pr-3 font-mono">${c.cost_usd.toFixed(4)}</td>
                        <td className="py-1.5 pr-3">{c.cache_hit ? <Badge variant="success">hit</Badge> : '—'}</td>
                        <td className="py-1.5 pr-3">
                          {c.success ? <Badge variant="success">ok</Badge> : <Badge variant="warning">fail</Badge>}
                        </td>
                        <td className="py-1.5 font-mono text-gray-500" title={c.request_id}>
                          {c.request_id.slice(0, 8)}\u2026
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-xs text-gray-500">
          Per-user rate: 1 generation per {Math.round(60 / Math.max(1, usage.rate_limit_per_minute))}s.
          Your usage today: {usage.user.daily_count ?? 0} / {usage.user.daily_quota ?? 0} \u00b7
          this month: {usage.user.monthly_count ?? 0} / {usage.user.monthly_quota ?? 0}.
        </div>
      </div>
    </div>
  )
}
