import { z } from "zod";
export const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  objective: z.string().max(4000).default(""),
  kind: z.enum(["finite", "continuous"]).default("finite"),
});
export const resourceInput = z.object({
  name: z.string().trim().min(1).max(120),
  path: z.string().min(1).max(4096),
});
export const sessionInput = z.object({
  project_id: z.string(),
  resource_id: z.string(),
  provider: z.enum(["shell", "codex", "claude"]).default("shell"),
});
export const taskInput = z.object({
  project_id: z.string(),
  target_workspace_id: z.string(),
  objective: z.string().trim().min(1).max(4000),
  query: z.string().trim().min(1).max(200),
  mode: z.literal("read_only").default("read_only"),
  parent_task_id: z.string().optional(),
  timeout_seconds: z.number().int().min(1).max(300).default(30),
  max_depth: z.literal(1).default(1),
  idempotency_key: z.string().min(1).max(200),
});
export const knowledgeInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(10000),
  scope: z.string().max(200),
  evidence: z
    .array(
      z.object({
        uri: z
          .string()
          .url()
          .refine(
            (value) =>
              ["http:", "https:", "file:"].includes(new URL(value).protocol),
            "Use URL http, https ou file",
          ),
        excerpt: z.string().max(2000),
      }),
    )
    .min(1)
    .max(20),
});
export type Project = z.infer<typeof projectInput> & {
  id: string;
  created_at: string;
};
export type Resource = z.infer<typeof resourceInput> & {
  id: string;
  kind: "repository";
  created_at: string;
};
export type Worksession = z.infer<typeof sessionInput> & {
  id: string;
  cwd: string;
  state: "stopped" | "running" | "interrupted";
  created_at: string;
};
export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "interrupted";
export type InvestigationResult = {
  summary: string;
  evidence: {
    uri: string;
    path: string;
    line: number;
    excerpt: string;
    revision: string | null;
  }[];
  files_read: string[];
  limitations: string[];
  actions: string[];
  usage: { provider: "local-search"; llm_calls: 0; cost_usd: 0 };
};
export type Task = z.infer<typeof taskInput> & {
  id: string;
  state: TaskStatus;
  result: InvestigationResult | null;
  error: string | null;
  created_at: string;
};
export type Knowledge = z.infer<typeof knowledgeInput> & {
  id: string;
  status: "proposed" | "validated" | "rejected" | "superseded";
  created_at: string;
};
