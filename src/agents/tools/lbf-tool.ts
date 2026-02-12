import { Type } from "@sinclair/typebox";
import { Agent as UndiciAgent } from "undici";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readNumberParam, readStringParam } from "./common.js";

const LBF_ACTIONS = [
  "list_programs",
  "list_projects",
  "list_tasks",
  "get_task",
  "create_task",
  "update_task",
  "move_task",
  "delete_task",
  "itsm_status",
  "itsm_sla",
] as const;

const PIPELINE_STAGES = [
  "backlog",
  "spec",
  "build",
  "verify",
  "validate",
  "deploy",
  "done",
] as const;
const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const LbfToolSchema = Type.Object({
  action: stringEnum(LBF_ACTIONS, {
    description:
      "Action to perform. list_programs: list all programs. list_projects: list projects in a program. list_tasks: list tasks in a project. get_task: get task details. create_task: create a new task. update_task: edit a task. move_task: move task to a pipeline stage. delete_task: delete a task. itsm_status: fleet status. itsm_sla: SLA percentages.",
  }),
  // list_projects
  program_id: Type.Optional(Type.Number({ description: "Program ID (for list_projects)." })),
  // list_tasks, create_task
  project_id: Type.Optional(
    Type.Number({ description: "Project ID (for list_tasks, create_task)." }),
  ),
  // get_task, update_task, move_task, delete_task
  task_id: Type.Optional(
    Type.Number({ description: "Task ID (for get_task, update_task, move_task, delete_task)." }),
  ),
  // create_task, update_task
  title: Type.Optional(Type.String({ description: "Task title (for create_task, update_task)." })),
  description: Type.Optional(Type.String({ description: "Task description." })),
  priority: Type.Optional(stringEnum(PRIORITIES, { description: "Task priority." })),
  assigned_to: Type.Optional(Type.String({ description: "Assignee name." })),
  // move_task
  stage: Type.Optional(
    stringEnum(PIPELINE_STAGES, {
      description: "Pipeline stage (for move_task, create_task, update_task).",
    }),
  ),
  // itsm_sla
  days: Type.Optional(Type.Number({ description: "SLA lookback days (default 30)." })),
});

// Undici dispatcher that skips TLS verification for internal self-signed servers
let _dispatcher: UndiciAgent | undefined;
function getDispatcher(): UndiciAgent {
  if (!_dispatcher) {
    _dispatcher = new UndiciAgent({ connect: { rejectUnauthorized: false } });
  }
  return _dispatcher;
}

function resolveLbfConfig(): { baseUrl: string; auth: string } {
  const baseUrl = (process.env.LBF_BASE_URL ?? "").trim();
  if (!baseUrl) {
    throw new Error("LBF_BASE_URL environment variable not set.");
  }
  const user = (process.env.LBF_USER ?? "").trim();
  const pass = (process.env.LBF_PASS ?? "").trim();
  if (!user || !pass) {
    throw new Error("LBF_USER / LBF_PASS environment variables not set.");
  }
  const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), auth };
}

async function lbfFetch(path: string, opts?: RequestInit): Promise<Response> {
  const { baseUrl, auth } = resolveLbfConfig();
  const headers = new Headers(opts?.headers);
  headers.set("Authorization", auth);
  // Use undici dispatcher for self-signed TLS cert support
  return await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers,
    // @ts-expect-error -- Node 22 native fetch accepts undici dispatcher
    dispatcher: getDispatcher(),
  });
}

async function lbfGetHtml(path: string): Promise<string> {
  const res = await lbfFetch(path);
  if (!res.ok) {
    throw new Error(`LBF ${path}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function lbfGetJson(path: string): Promise<unknown> {
  const res = await lbfFetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`LBF ${path}: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function lbfPost(path: string, body: Record<string, string>): Promise<unknown> {
  const params = new URLSearchParams(body);
  const res = await lbfFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LBF POST ${path}: ${res.status} ${res.statusText} ${text}`.trim());
  }
  // POST endpoints may return JSON or redirect HTML
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return await res.json();
  }
  return { ok: true, status: res.status };
}

// --- HTML parsers ---

function parsePrograms(html: string) {
  const programs: {
    id: number;
    name: string;
    emoji: string;
    description: string;
    projects: number;
    open: number;
    done: number;
    total: number;
  }[] = [];
  const cardRegex =
    /href="\/programs\/(\d+)"[\s\S]*?program-emoji">(.*?)<[\s\S]*?program-name">(.*?)<[\s\S]*?program-desc">(.*?)<[\s\S]*?program-stat-value">(\d+)[\s\S]*?program-stat-value">(\d+)[\s\S]*?program-stat-value">(\d+)[\s\S]*?program-stat-value">(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    programs.push({
      id: Number(m[1]),
      name: decodeHtmlEntities(m[3].trim()),
      emoji: m[2].trim(),
      description: decodeHtmlEntities(m[4].trim()),
      projects: Number(m[5]),
      open: Number(m[6]),
      done: Number(m[7]),
      total: Number(m[8]),
    });
  }
  return programs;
}

function parseProjects(html: string) {
  const projects: {
    id: number;
    name: string;
    description: string;
    status: string;
    completion: string;
  }[] = [];
  const cardRegex =
    /href="\/projects\/(\d+)"[\s\S]*?project-card-name">(.*?)<[\s\S]*?project-card-status\s+(\w+)">(.*?)<[\s\S]*?project-card-desc">(.*?)<[\s\S]*?project-card-pct">(.*?)</g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    projects.push({
      id: Number(m[1]),
      name: decodeHtmlEntities(m[2].trim()),
      status: m[4].trim(),
      description: decodeHtmlEntities(m[5].trim()),
      completion: m[6].trim(),
    });
  }
  return projects;
}

function parseTasks(html: string) {
  const tasks: { id: number; title: string; stage: string; priority: string; assignee: string }[] =
    [];
  // Parse column by column
  const colRegex =
    /column-title">(.*?)<[\s\S]*?column-body">([\s\S]*?)(?=<\/div>\s*<\/div>\s*(?:<div class="column">|<\/div>))/g;
  let cm: RegExpExecArray | null;
  while ((cm = colRegex.exec(html)) !== null) {
    const stage = cm[1].trim().toLowerCase();
    const body = cm[2];
    const taskRegex =
      /href="\/tasks\/(\d+)"[\s\S]*?card-title">\s*([\s\S]*?)\s*<\/div>[\s\S]*?badge-member[^>]*>(.*?)<[\s\S]*?badge-priority\s+(\w+)">[^<]*<\/span>/g;
    let tm: RegExpExecArray | null;
    while ((tm = taskRegex.exec(body)) !== null) {
      tasks.push({
        id: Number(tm[1]),
        title: decodeHtmlEntities(tm[2].trim()),
        stage,
        assignee: tm[3].trim(),
        priority: tm[4].trim(),
      });
    }
  }
  return tasks;
}

function parseTaskDetail(html: string) {
  const titleMatch = html.match(/detail-title">([\s\S]*?)<\/h1/);
  const fields: Record<string, string> = {};
  const fieldRegex = /<label>(.*?)<\/label>\s*<div class="value[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let fm: RegExpExecArray | null;
  while ((fm = fieldRegex.exec(html)) !== null) {
    fields[fm[1].trim().toLowerCase().replace(/\s+/g, "_")] = decodeHtmlEntities(fm[2].trim());
  }
  // Extract description separately (it's in a different structure)
  const descMatch = html.match(/detail-description">([\s\S]*?)<\/div>/);
  return {
    title: titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "unknown",
    ...fields,
    ...(descMatch ? { description: decodeHtmlEntities(descMatch[1].trim()) } : {}),
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013");
}

// --- Action handlers ---

async function listPrograms() {
  const html = await lbfGetHtml("/");
  return { programs: parsePrograms(html) };
}

async function listProjects(programId: number) {
  const html = await lbfGetHtml(`/programs/${programId}`);
  return { program_id: programId, projects: parseProjects(html) };
}

async function listTasks(projectId: number) {
  const html = await lbfGetHtml(`/projects/${projectId}`);
  return { project_id: projectId, tasks: parseTasks(html) };
}

async function getTask(taskId: number) {
  const html = await lbfGetHtml(`/tasks/${taskId}`);
  return { task_id: taskId, ...parseTaskDetail(html) };
}

async function createTask(
  projectId: number,
  title: string,
  opts: { description?: string; priority?: string; assigned_to?: string; stage?: string },
) {
  const body: Record<string, string> = { title };
  if (opts.description) {
    body.description = opts.description;
  }
  if (opts.priority) {
    body.priority = opts.priority;
  }
  if (opts.assigned_to) {
    body.assigned_to = opts.assigned_to;
  }
  if (opts.stage) {
    body.pipeline_stage = opts.stage;
  }
  await lbfPost(`/projects/${projectId}/tasks/new`, body);
  return { ok: true, project_id: projectId, title };
}

async function updateTask(
  taskId: number,
  opts: {
    title?: string;
    description?: string;
    priority?: string;
    assigned_to?: string;
    stage?: string;
  },
) {
  const body: Record<string, string> = {};
  if (opts.title) {
    body.title = opts.title;
  }
  if (opts.description) {
    body.description = opts.description;
  }
  if (opts.priority) {
    body.priority = opts.priority;
  }
  if (opts.assigned_to) {
    body.assigned_to = opts.assigned_to;
  }
  if (opts.stage) {
    body.pipeline_stage = opts.stage;
  }
  await lbfPost(`/tasks/${taskId}/edit`, body);
  return { ok: true, task_id: taskId };
}

async function moveTask(taskId: number, stage: string) {
  await lbfPost(`/tasks/${taskId}/move`, { stage });
  return { ok: true, task_id: taskId, stage };
}

async function deleteTask(taskId: number) {
  await lbfPost(`/tasks/${taskId}/delete`, {});
  return { ok: true, task_id: taskId, deleted: true };
}

async function itsmStatus() {
  return await lbfGetJson("/api/itsm/status");
}

async function itsmSla(days: number) {
  return await lbfGetJson(`/api/itsm/sla?days=${days}`);
}

export function createLbfTool(): AnyAgentTool {
  return {
    label: "LBF",
    name: "lbf",
    description:
      "LBF Enterprise task board — manage programs, projects, and tasks. Pipeline stages: backlog → spec → build → verify → validate → deploy → done. Also provides ITSM fleet status and SLA monitoring.",
    parameters: LbfToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      if (action === "list_programs") {
        return jsonResult(await listPrograms());
      }
      if (action === "list_projects") {
        const programId = readNumberParam(params, "program_id", { required: true, integer: true })!;
        return jsonResult(await listProjects(programId));
      }
      if (action === "list_tasks") {
        const projectId = readNumberParam(params, "project_id", { required: true, integer: true })!;
        return jsonResult(await listTasks(projectId));
      }
      if (action === "get_task") {
        const taskId = readNumberParam(params, "task_id", { required: true, integer: true })!;
        return jsonResult(await getTask(taskId));
      }
      if (action === "create_task") {
        const projectId = readNumberParam(params, "project_id", { required: true, integer: true })!;
        const title = readStringParam(params, "title", { required: true });
        return jsonResult(
          await createTask(projectId, title, {
            description: readStringParam(params, "description"),
            priority: readStringParam(params, "priority"),
            assigned_to: readStringParam(params, "assigned_to"),
            stage: readStringParam(params, "stage"),
          }),
        );
      }
      if (action === "update_task") {
        const taskId = readNumberParam(params, "task_id", { required: true, integer: true })!;
        return jsonResult(
          await updateTask(taskId, {
            title: readStringParam(params, "title"),
            description: readStringParam(params, "description"),
            priority: readStringParam(params, "priority"),
            assigned_to: readStringParam(params, "assigned_to"),
            stage: readStringParam(params, "stage"),
          }),
        );
      }
      if (action === "move_task") {
        const taskId = readNumberParam(params, "task_id", { required: true, integer: true })!;
        const stage = readStringParam(params, "stage", { required: true });
        return jsonResult(await moveTask(taskId, stage));
      }
      if (action === "delete_task") {
        const taskId = readNumberParam(params, "task_id", { required: true, integer: true })!;
        return jsonResult(await deleteTask(taskId));
      }
      if (action === "itsm_status") {
        return jsonResult(await itsmStatus());
      }
      if (action === "itsm_sla") {
        const days = readNumberParam(params, "days", { integer: true }) ?? 30;
        return jsonResult(await itsmSla(days));
      }

      throw new Error(`Unknown LBF action: ${action}`);
    },
  };
}
