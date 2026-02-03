import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

type TaskConfig = { id: string; title: string; score: number }
type TasksConfigFile = { tasks: TaskConfig[] }
type DailyTaskEntry = { completed: boolean; completedAt?: string }
type StatusResponse = { date: string; status: Record<string, DailyTaskEntry> }

function todayYYYYMMDD() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null)

  return () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = ctxRef.current ?? new Ctx()
      ctxRef.current = ctx

      const o = ctx.createOscillator()
      const g = ctx.createGain()

      o.type = 'sine'
      o.frequency.value = 880
      g.gain.value = 0.0001

      o.connect(g)
      g.connect(ctx.destination)

      const now = ctx.currentTime
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

      o.start(now)
      o.stop(now + 0.13)
    } catch {
      // ignore
    }
  }
}

export function CheckinPage() {
  const [date] = useState(() => todayYYYYMMDD())
  const [tasks, setTasks] = useState<TaskConfig[]>([])
  const [status, setStatus] = useState<Record<string, DailyTaskEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const beep = useBeep()

  const completedCount = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (status[t.id]?.completed ? 1 : 0), 0)
  }, [tasks, status])

  const remainingCount = Math.max(0, tasks.length - completedCount)

  const totalScore = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (Number.isFinite(t.score) ? t.score : 0), 0)
  }, [tasks])

  const earnedScore = useMemo(() => {
    return tasks.reduce(
      (acc, t) => acc + (status[t.id]?.completed ? (Number.isFinite(t.score) ? t.score : 0) : 0),
      0,
    )
  }, [tasks, status])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [cfgRes, statusRes] = await Promise.all([
          fetch('/api/config'),
          fetch(`/api/status?date=${encodeURIComponent(date)}`),
        ])
        if (!cfgRes.ok) throw new Error(`读取配置失败: ${cfgRes.status}`)
        if (!statusRes.ok) throw new Error(`读取打卡记录失败: ${statusRes.status}`)
        const cfg = (await cfgRes.json()) as TasksConfigFile
        const st = (await statusRes.json()) as StatusResponse
        if (cancelled) return
        setTasks(cfg.tasks ?? [])
        setStatus(st.status ?? {})
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
  }, [date])

  async function toggle(taskId: string, completed: boolean) {
    setSaving(taskId)
    setError(null)
    setStatus((s) => ({
      ...s,
      [taskId]: completed
        ? { completed: true, completedAt: new Date().toISOString() }
        : { completed: false },
    }))
    beep()
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, taskId, completed }),
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg?.error ?? `保存失败: ${res.status}`)
      }
      const data = (await res.json()) as StatusResponse
      setStatus(data.status ?? {})
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
      try {
        const r = await fetch(`/api/status?date=${encodeURIComponent(date)}`)
        if (r.ok) {
          const d = (await r.json()) as StatusResponse
          setStatus(d.status ?? {})
        }
      } catch {
        // ignore
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">每日打卡</h1>
        <div className="date">{date}</div>
      </div>

      <div className="card">
        <div className="cardBody">
          {loading ? (
            <div className="muted">加载中…</div>
          ) : tasks.length === 0 ? (
            <div className="muted">
              没有配置任务。请在根目录编辑 <code>tasks.config.json</code>。
            </div>
          ) : (
            <ul className="list">
              {tasks.map((t) => {
                const checked = Boolean(status[t.id]?.completed)
                const busy = saving === t.id
                const completedAt = status[t.id]?.completedAt
                const completedAtText =
                  checked && completedAt
                    ? new Date(completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'
                return (
                  <li className="item" key={t.id}>
                    <label className="left">
                      <input
                        className="checkbox"
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => toggle(t.id, e.target.checked)}
                      />
                      <span className={`taskTitle ${checked ? 'done' : ''}`}>{t.title}</span>
                    </label>
                    <span className="right">
                      <span className={`score ${checked ? 'scoreEarned' : 'scorePending'}`}>
                        {checked ? `+${t.score}` : `${t.score}`}
                      </span>
                      <span className="time">{completedAtText}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="footer">
          <div className="muted">
            已完成 {completedCount} 个，还差 {remainingCount} 个（共 {tasks.length} 个）｜得分 {earnedScore}/
            {totalScore}
          </div>
          <Link className="link" to="/stats">
            近一周统计 →
          </Link>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

