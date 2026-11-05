// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";
import { createSession, logIn } from "@/server/auth";
import { body, enforce, route } from "@/server/http";
import { clientIp, limiter, LIMITS } from "@/server/rate-limit";

const Input = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = route(async (req) => {
  enforce(limiter(`login:${clientIp(req)}`, LIMITS.login), "sign-in attempts");
  const { email, password } = await body(req, Input);
  enforce(limiter(`login-email:${email.toLowerCase()}`, LIMITS.loginPerEmail), "sign-in attempts");
  await createSession(await logIn(email, password));
  return { ok: true };
});
