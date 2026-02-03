import fs from "node:fs/promises";
import path from "node:path";

import type { DailyFileShape, DailyTaskEntry, DailyTaskStatus, TasksConfigFile } from "./types";

const ROOT_DIR = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(ROOT_DIR, "tasks.config.json");
const DATA_DIR = path.join(ROOT_DIR, "data");

export function dateFromToday(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function listAllDailyDates(): Promise<string[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const dates: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(e.name);
    if (m) dates.push(m[1]);
  }
  dates.sort();
  return dates;
}

export function normalizeDate(input: string): string {
  // Accept YYYY-MM-DD only
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error("Invalid date format, expected YYYY-MM-DD");
  }
  return input;
}

export function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function readTasksConfig(): Promise<TasksConfigFile> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(raw) as TasksConfigFile;

  if (!parsed || !Array.isArray(parsed.tasks)) {
    throw new Error("Invalid tasks.config.json: missing tasks array");
  }
  for (const t of parsed.tasks) {
    if (!t || typeof t.id !== "string" || typeof t.title !== "string") {
      throw new Error("Invalid tasks.config.json: each task needs id/title");
    }
    // Backward compatible: default score=1 if missing
    const anyT = t as any;
    if (typeof anyT.score === "undefined") {
      anyT.score = 1;
    }
    if (typeof anyT.score !== "number" || !Number.isFinite(anyT.score) || anyT.score < 0) {
      throw new Error("Invalid tasks.config.json: each task score must be a number >= 0");
    }
  }
  return parsed;
}

function dailyFilePath(date: string): string {
  return path.join(DATA_DIR, `${date}.json`);
}

export async function readDailyStatusOrEmpty(date: string): Promise<DailyTaskStatus> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const p = dailyFilePath(date);
  try {
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw) as DailyFileShape;
    if (!parsed || typeof parsed !== "object" || typeof parsed.status !== "object") {
      return {};
    }
    const statusAny = (parsed as any).status as Record<string, unknown>;
    const normalized: DailyTaskStatus = {};
    for (const [taskId, v] of Object.entries(statusAny ?? {})) {
      if (typeof v === "boolean") {
        // Backward compatible: old files stored boolean only
        normalized[taskId] = { completed: v };
      } else if (v && typeof v === "object") {
        const obj = v as any;
        normalized[taskId] = {
          completed: Boolean(obj.completed),
          completedAt: typeof obj.completedAt === "string" ? obj.completedAt : undefined,
        };
      }
    }
    return normalized;
  } catch (e: any) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

export async function writeDailyStatus(date: string, status: DailyTaskStatus): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload: DailyFileShape = {
    date,
    updatedAt: new Date().toISOString(),
    status,
  };
  const p = dailyFilePath(date);
  await fs.writeFile(p, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function setEntryCompleted(entry: DailyTaskEntry | undefined, completed: boolean): DailyTaskEntry {
  if (!completed) {
    return { completed: false };
  }
  if (entry?.completed && entry.completedAt) {
    // already completed; keep first completion time
    return entry;
  }
  return { completed: true, completedAt: new Date().toISOString() };
}

