import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

type TaskConfig = { id: string; title: string; score: number }
type TasksConfigFile = { tasks: TaskConfig[]; doubleScoreDates?: string[] }
type DailyTaskEntry = { completed: boolean; completedAt?: string }
type StatusResponse = { date: string; status: Record<string, DailyTaskEntry>; totalScore: number; earnedScore: number; taskScores: Record<string, number> }

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

      const now = ctx.currentTime

      // 创建一个欢快的上升音效
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (C大调和弦)
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()

        o.type = 'triangle'
        o.frequency.value = freq

        o.connect(g)
        g.connect(ctx.destination)

        const startTime = now + i * 0.08
        const duration = 0.15

        g.gain.setValueAtTime(0, startTime)
        g.gain.linearRampToValueAtTime(0.15, startTime + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

        o.start(startTime)
        o.stop(startTime + duration)
      })
    } catch {
      // ignore
    }
  }
}

export function CheckinPage() {
  const [date] = useState(() => todayYYYYMMDD())
  const [tasks, setTasks] = useState<TaskConfig[]>([])
  const [status, setStatus] = useState<Record<string, DailyTaskEntry>>({})
  const [taskScores, setTaskScores] = useState<Record<string, number>>({})
  const [totalScore, setTotalScore] = useState(0)
  const [earnedScore, setEarnedScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null)
  const [doubleScoreDates, setDoubleScoreDates] = useState<string[]>([])
  const beep = useBeep()

  const isDoubleScoreDay = useMemo(() => {
    return doubleScoreDates.includes(date)
  }, [doubleScoreDates, date])

  const completedCount = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (status[t.id]?.completed ? 1 : 0), 0)
  }, [tasks, status])

  const remainingCount = Math.max(0, tasks.length - completedCount)

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
        setDoubleScoreDates(cfg.doubleScoreDates ?? [])
        setStatus(st.status ?? {})
        setTaskScores(st.taskScores ?? {})
        setTotalScore(st.totalScore ?? 0)
        setEarnedScore(st.earnedScore ?? 0)
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
    if (completed) {
      beep()
      setCelebratingTaskId(taskId)
      setTimeout(() => setCelebratingTaskId(null), 600)
    }
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
      setTaskScores(data.taskScores ?? {})
      setTotalScore(data.totalScore ?? 0)
      setEarnedScore(data.earnedScore ?? 0)
    } catch (e: any) {
      setError(e?.message ?? '保存失败')
      try {
        const r = await fetch(`/api/status?date=${encodeURIComponent(date)}`)
        if (r.ok) {
          const d = (await r.json()) as StatusResponse
          setStatus(d.status ?? {})
          setTaskScores(d.taskScores ?? {})
          setTotalScore(d.totalScore ?? 0)
          setEarnedScore(d.earnedScore ?? 0)
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
        <h1 className="title">🧧 每日打卡</h1>
        <div className={`date ${isDoubleScoreDay ? 'doubleScoreDay' : ''}`}>
          {isDoubleScoreDay ? '✨ ' : ''}{date}{isDoubleScoreDay ? ' ✨' : ''}
        </div>
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
                const completedAtText = checked && completedAt
                  ? new Date(completedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
                const displayScore = taskScores[t.id] ?? t.score
                const isCelebrating = celebratingTaskId === t.id
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
                      <span className={`taskTitle ${checked ? 'done' : ''} ${isCelebrating ? 'celebrating' : ''}`}>
                        {t.title}
                      </span>
                    </label>
                    <span className="right">
                      {completedAtText && (
                        <span className="time">完成时间：{completedAtText}</span>
                      )}
                      <span className={`score ${checked ? 'scoreEarned' : 'scorePending'}`}>
                        {checked ? `+${displayScore}` : `${displayScore}`}
                      </span>
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
        </div>
      </div>

      <Link className="link statsLink" to="/stats">
        🎊 近一周统计 →
      </Link>

      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}

