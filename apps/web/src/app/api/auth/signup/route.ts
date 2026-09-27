import { z } from "zod";
import { createSession, signUp } from "@/server/auth";
import { body, route } from "@/server/http";

const Input = z.object({ email: z.string().email(), name: z.string().min(1).max(80), password: z.string().min(8).max(200) });

export const POST = route(async (req) => {
  const input = await body(req, Input);
  const userId = await signUp(input);
  await createSession(userId);
  return { ok: true };
});
