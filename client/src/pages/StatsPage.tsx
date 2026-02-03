import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import '../App.css'

type StatsPoint = {
  date: string
  completedCount: number
  earnedScore: number
  totalScore: number
  cumulativeEarnedScore: number
}

type StatsResponse = {
  days: number
  tasksCount: number
  totalScorePerDay: number
  totalEarnedBeforeRange: number
  data: StatsPoint[]
}

export function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/stats?days=7')
        if (!res.ok) throw new Error(`读取统计失败: ${res.status}`)
        const json = (await res.json()) as StatsResponse
        if (cancelled) return
        setData(json)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const latest = useMemo(() => data?.data?.[data.data.length - 1], [data])

  return (
    <div className="container">
      <div className="header">
        <div className="headerLeft">
          <Link className="backBtn" to="/">
            ← 返回
          </Link>
          <h1 className="title">🎊 近一周统计</h1>
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          {loading ? (
            <div className="muted">加载中…</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : !data ? (
            <div className="muted">暂无数据</div>
          ) : (
            <div className="statsGrid">
              <div className="statsKpis">
                <div className="kpi">
                  <div className="kpiLabel">今日完成</div>
                  <div className="kpiValue">
                    {latest?.completedCount ?? 0}/{data.tasksCount}
                  </div>
                </div>
                <div className="kpi">
                  <div className="kpiLabel">今日得分</div>
                  <div className="kpiValue">
                    {latest?.earnedScore ?? 0}/{latest?.totalScore ?? 0}
                  </div>
                </div>
                <div className="kpi">
                  <div className="kpiLabel">累计总分（至今）</div>
                  <div className="kpiValue">{latest?.cumulativeEarnedScore ?? 0}</div>
                </div>
              </div>

              <div className="chartCard">
                <div className="chartTitle">每日完成任务数</div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} width={30} />
                      <Tooltip />
                      <Bar dataKey="completedCount" fill="#c41e3a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chartCard">
                <div className="chartTitle">每日获得积分</div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} width={30} />
                      <Tooltip />
                      <Bar dataKey="earnedScore" fill="#fa8c16" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chartCard">
                <div className="chartTitle">累计总分（按日期）</div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} width={30} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="cumulativeEarnedScore"
                        stroke="#d4380d"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#d4380d" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

