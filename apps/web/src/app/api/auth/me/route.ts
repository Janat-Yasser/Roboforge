// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";

export const GET = route(async () => ({ user: await requireUser() }));
