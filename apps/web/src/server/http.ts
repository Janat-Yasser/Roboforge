import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z, type ZodTypeAny } from "zod";
import { CommandError } from "@roboforge/spec";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found.`);
export const forbidden = () => new ApiError(403, "FORBIDDEN", "You do not have access to this resource.");
export const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Sign in required.");

type Ctx<P> = { params: Promise<P> };

/**
 * Route handler wrapper: maps domain errors to a uniform JSON error shape
 * `{ error: { code, message, details? } }` and logs unexpected failures.
 */
export function route<P = Record<string, string>>(handler: (req: Request, ctx: { params: P }) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      const params = (await ctx?.params) ?? ({} as P);
      const out = await handler(req, { params });
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Request validation failed.", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 400 },
    );
  }
  if (e instanceof CommandError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: { commandIndex: e.commandIndex } } }, { status: 422 });
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Internal server error." } }, { status: 500 });
}

/** Throws a 429 when a rate limit is exceeded. */
export function enforce(result: { ok: boolean; retryAfterSec: number }, what = "requests"): void {
  if (!result.ok) {
    throw new ApiError(429, "RATE_LIMITED", `Too many ${what}. Try again in ${Math.max(1, Math.ceil(result.retryAfterSec / 60))} min.`, {
      retryAfterSec: result.retryAfterSec,
    });
  }
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be JSON.");
  }
  return schema.parse(raw);
}
