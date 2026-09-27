import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { assistantEnabled, propose } from "@/server/services/assistant";

const Input = z.object({
  prompt: z.string().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).default([]),
});

export const GET = route(async () => {
  await requireUser();
  return { enabled: assistantEnabled() };
});

/** Returns a proposal (commands + summary). Apply it through /commands after review. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { prompt, history } = await body(req, Input);
  return propose(await requireUser(), params.id, prompt, history);
});
