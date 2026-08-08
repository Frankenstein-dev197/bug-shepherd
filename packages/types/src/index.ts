export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "developer" | "tester";
  createdAt: string;
};

export type Bug = {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "assigned" | "in_progress" | "resolved" | "closed";
  assigneeId?: string;
  reporterId: string;
  createdAt: string;
};
