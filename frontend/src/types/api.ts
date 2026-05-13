export type AppRole = "admin" | "pm" | "usuario";
export type LifecycleStatus = "pending" | "estimated" | "in_progress" | "completed";
export type DashboardView = "mine" | "in_progress" | "overdue";

export type TaskDashboardItem = {
  id: string;
  project_id: string;
  project_title: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: LifecycleStatus;
  deleted_at: string | null;
};

export type ProjectMemberOut = {
  user_id: string;
  role: "pm" | "colaborador";
  name: string;
  email: string;
};

export type ProjectListItem = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: LifecycleStatus;
  project_manager_id: string;
  deleted_at: string | null;
};

export type ProjectDetail = ProjectListItem & {
  members: ProjectMemberOut[];
};

export type TaskPublic = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: LifecycleStatus;
  deleted_at: string | null;
};

export type TaskAssigneeOut = { user_id: string; name: string; email: string };

export type TaskDetail = TaskPublic & { assignees: TaskAssigneeOut[] };

export type TaskUpdatePublic = {
  id: string;
  task_id: string;
  user_id: string;
  author_name: string;
  comment: string;
  progress: number | null;
  is_blocked: boolean;
  created_at: string;
};

export type UserPublic = {
  id: string;
  name: string;
  email: string;
  app_role: AppRole;
  telegram_id: string | null;
  deleted_at: string | null;
};
