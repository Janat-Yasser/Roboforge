// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { destroySession } from "@/server/auth";
import { route } from "@/server/http";

export const POST = route(async () => {
  await destroySession();
  return { ok: true };
});
