import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, enforce, route } from "@/server/http";
import { limiter, LIMITS } from "@/server/rate-limit";
import { assistantEnabled, propose } from "@/server/services/assistant";

const Input = z.object({
  prompt: z.string().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20).default([]),
});

export const GET = route(async () => {
  await requireUser();
  return { enabled: assistantEnabled() };
});

/** Returns a proposal (commands + summary). Apply it through /commands after review. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  // Each request can run up to 12 model turns on your API key: cap it per user.
  enforce(limiter(`assistant:${user.id}`, LIMITS.assistant), "assistant requests");
  const { prompt, history } = await body(req, Input);
  return propose(user, params.id, prompt, history);
});
