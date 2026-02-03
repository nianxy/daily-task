export type TaskConfig = {
  id: string;
  title: string;
  score: number;
};

export type TasksConfigFile = {
  tasks: TaskConfig[];
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

