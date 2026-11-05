// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getBuild } from "@/server/services/builds";

export const GET = route<{ id: string }>(async (_req, { params }) => ({ build: await getBuild(await requireUser(), params.id) }));
