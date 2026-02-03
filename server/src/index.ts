import express from "express";
import cors from "cors";

import {
  dateFromToday,
  getTodayDateString,
  listAllDailyDates,
  normalizeDate,
  readDailyStatusOrEmpty,
  readTasksConfig,
  setEntryCompleted,
  writeDailyStatus,
} from "./storage";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", async (_req, res) => {
  try {
    const config = await readTasksConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "failed_to_read_config" });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const date = normalizeDate(String(req.query.date ?? getTodayDateString()));
    const status = await readDailyStatusOrEmpty(date);
    res.json({ date, status });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "bad_request" });
  }
});

app.post("/api/status", async (req, res) => {
  try {
    const body = req.body as { date?: string; taskId?: string; completed?: boolean };
    const date = normalizeDate(body.date ?? getTodayDateString());
    const taskId = String(body.taskId ?? "");
    const completed = Boolean(body.completed);
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const config = await readTasksConfig();
    if (!config.tasks.some((t) => t.id === taskId)) {
      return res.status(400).json({ error: "unknown taskId" });
    }

    const prev = await readDailyStatusOrEmpty(date);
    const next = { ...prev, [taskId]: setEntryCompleted(prev[taskId], completed) };
    await writeDailyStatus(date, next);
    res.json({ date, status: next });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "bad_request" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const daysRaw = req.query.days;
    const days = Math.max(1, Math.min(30, Number(daysRaw ?? 7) || 7));
    const tasksConfig = await readTasksConfig();
    const tasks = tasksConfig.tasks;
    const totalScore = tasks.reduce((acc, t) => acc + t.score, 0);

    const range: string[] = [];
    for (let i = -days + 1; i <= 0; i += 1) {
      range.push(dateFromToday(i));
    }

    const allDates = await listAllDailyDates();
    const earnedByDate = new Map<string, number>();
    for (const d of allDates) {
      const st = await readDailyStatusOrEmpty(d);
      let earned = 0;
      for (const t of tasks) {
        if (st[t.id]?.completed) earned += t.score;
      }
      earnedByDate.set(d, earned);
    }

    const daysData: Array<{
      date: string;
      completedCount: number;
      earnedScore: number;
      totalScore: number;
      cumulativeEarnedScore: number;
    }> = [];

    const rangeStart = range[0]!;
    let totalEarnedBeforeRange = 0;
    for (const [d, earned] of earnedByDate.entries()) {
      if (d < rangeStart) totalEarnedBeforeRange += earned;
    }

    let cumulative = totalEarnedBeforeRange;
    for (const date of range) {
      const st = await readDailyStatusOrEmpty(date);
      let completedCount = 0;
      let earnedScore = 0;
      for (const t of tasks) {
        if (st[t.id]?.completed) {
          completedCount += 1;
          earnedScore += t.score;
        }
      }
      cumulative += earnedScore;
      daysData.push({ date, completedCount, earnedScore, totalScore, cumulativeEarnedScore: cumulative });
    }

    res.json({
      days,
      tasksCount: tasks.length,
      totalScorePerDay: totalScore,
      totalEarnedBeforeRange,
      data: daysData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "stats_failed" });
  }
});

const PORT = Number(process.env.PORT ?? 5174);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`daily-task server listening on http://localhost:${PORT}`);
});

