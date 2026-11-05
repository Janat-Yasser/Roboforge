// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";
import { createSession, signUp } from "@/server/auth";
import { body, enforce, route } from "@/server/http";
import { clientIp, limiter, LIMITS } from "@/server/rate-limit";

const Input = z.object({ email: z.string().email(), name: z.string().min(1).max(80), password: z.string().min(8).max(200) });

export const POST = route(async (req) => {
  enforce(limiter(`signup:${clientIp(req)}`, LIMITS.signup), "sign-ups");
  const input = await body(req, Input);
  const userId = await signUp(input);
  await createSession(userId);
  return { ok: true };
});
