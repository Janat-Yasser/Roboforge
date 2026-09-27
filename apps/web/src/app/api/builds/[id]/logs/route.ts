import { requireUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { getBuild, logsAfter } from "@/server/services/builds";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: streams build log lines and status/step updates until the build finishes.
 * Events: `log` {id, stream, line}; `build` {status, steps, artifactKey}; `end`.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let user;
  try {
    user = await requireUser();
    await getBuild(user, id);
  } catch (e) {
    return errorResponse(e);
  }
  const encoder = new TextEncoder();
  let cursor = Number(new URL(req.url).searchParams.get("after") ?? 0);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let lastState = "";
      try {
        for (let i = 0; i < 60 * 30 * 2 && !req.signal.aborted; i++) {
          const lines = await logsAfter(id, cursor);
          for (const l of lines) {
            send("log", l);
            cursor = l.id;
          }
          const b = await getBuild(user!, id);
          const state = JSON.stringify([b.status, b.steps, b.artifactKey]);
          if (state !== lastState) {
            send("build", { status: b.status, steps: b.steps, artifactKey: b.artifactKey, error: b.error });
            lastState = state;
          }
          if (["succeeded", "failed", "canceled"].includes(b.status) && lines.length === 0) {
            send("end", {});
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
