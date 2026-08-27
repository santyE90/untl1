export type TaskStatus = "todo" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  due_at: string | null;
  estimated_effort_minutes: number | null;
  assessment_id: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithContext = TaskRecord & {
  assessment: { id: string; name: string; courseId: string; courseCode: string } | null;
};
