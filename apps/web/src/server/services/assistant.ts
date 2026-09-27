import "server-only";
import { AnthropicClient, runAssistant, type Message } from "@roboforge/assistant";
import { RobotSpec } from "@roboforge/spec";
import type { SessionUser } from "../auth";
import { ApiError } from "../http";
import { getCatalog } from "./catalog";
import { getProjectForUser } from "./projects";

export function assistantEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Runs the assistant against the project's current spec and returns a proposal. Nothing is persisted. */
export async function propose(user: SessionUser, projectId: string, prompt: string, history: Message[]) {
  if (!assistantEnabled()) throw new ApiError(503, "ASSISTANT_DISABLED", "Set ANTHROPIC_API_KEY on the server to enable the assistant.");
  const p = await getProjectForUser(user, projectId);
  const catalog = await getCatalog();
  const client = new AnthropicClient(process.env.ANTHROPIC_API_KEY!, process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5");
  const r = await runAssistant({ spec: RobotSpec.parse(p.spec), catalog, prompt, history, client });
  return { baseRevision: p.revision, reply: r.reply, commands: r.commands, before: r.before, after: r.after, toolCalls: r.toolCalls };
}
