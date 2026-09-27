import { z } from "zod";
import { createSession, logIn } from "@/server/auth";
import { body, route } from "@/server/http";

const Input = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = route(async (req) => {
  const { email, password } = await body(req, Input);
  await createSession(await logIn(email, password));
  return { ok: true };
});
