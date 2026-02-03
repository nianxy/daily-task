export type TaskConfig = {
  id: string;
  title: string;
  score: number;
};

export type TasksConfigFile = {
  tasks: TaskConfig[];
  doubleScoreDates?: string[]; // YYYY-MM-DD 格式的日期列表，这些日期的任务积分翻倍
};

export type DailyTaskEntry = {
  completed: boolean;
  completedAt?: string; // ISO string
};

export type DailyTaskStatus = Record<string, DailyTaskEntry>;

export type DailyFileShape = {
  date: string; // YYYY-MM-DD
  updatedAt: string; // ISO string
  status: DailyTaskStatus;
};

