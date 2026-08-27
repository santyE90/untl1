export type GoalStatus = "active" | "completed";
export type GoalCategory = "finance" | "school" | "career" | "personal" | "health_fitness" | "project" | "other";
export type GoalProgressMode = "none" | "percentage" | "numeric";

export type GoalRecord = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  deadline: string | null;
  progress_mode: string;
  current_value_decimal: string | null;
  target_value_decimal: string | null;
  unit_label: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalMilestoneRecord = {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalTaskRecord = {
  id: string;
  goal_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  due_at: string | null;
  archived_at: string | null;
};

export type GoalWithRelations = GoalRecord & {
  milestones: GoalMilestoneRecord[];
  tasks: GoalTaskRecord[];
};
