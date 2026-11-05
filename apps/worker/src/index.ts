// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Build worker. Claims queued builds from Postgres (FOR UPDATE SKIP LOCKED), runs the pipeline and
 * streams logs/steps back. Run several instances for parallelism.
 */
import { hostname } from "node:os";
import { and, eq, sql } from "drizzle-orm";
import { buildLogs, builds, componentVersions, getDb, getPool, LocalObjectStore, projectFiles, projectRevisions, type BuildStep } from "@roboforge/db";
import { MapCatalog, RobotSpec, type ComponentDefinition } from "@roboforge/spec";
import { runBuild, type BuildReporter } from "./pipeline";
import { DockerSandbox } from "./sandbox";

const WORKER_ID = `${hostname()}-${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
const db = getDb();
const store = new LocalObjectStore();
const sandbox = new DockerSandbox();
let stopping = false;

async function claim(): Promise<{ id: string; project_id: string; revision: number; steps: BuildStep[] } | null> {
  const res = await db.execute(sql`
    update builds set status = 'running', started_at = now(), worker_id = ${WORKER_ID}
    where id = (select id from builds where status = 'queued' order by queued_at for update skip locked limit 1)
    returning id, project_id, revision, steps`);
  return (res.rows[0] as never) ?? null;
}

function reporter(buildId: string, initial: BuildStep[]): BuildReporter & { flush(): Promise<void> } {
  const steps = initial.map((s) => ({ ...s }));
  let pending: { buildId: string; stream: string; line: string }[] = [];
  let timer: NodeJS.Timeout | null = null;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const batch = pending;
    pending = [];
    if (batch.length) await db.insert(buildLogs).values(batch);
  };
  return {
    log(line, stream = "stdout") {
      pending.push({ buildId, stream, line: line.slice(0, 4000) });
      if (pending.length > 200) void flush();
      else timer ??= setTimeout(() => void flush(), 250);
    },
    async step(name, status, detail) {
      const s = steps.find((x) => x.name === name);
      if (s) {
        s.status = status;
        if (detail) s.detail = detail;
        else delete s.detail;
      }
      await flush();
      await db.update(builds).set({ steps }).where(eq(builds.id, buildId));
    },
    flush,
  };
}

async function loadCatalog(): Promise<MapCatalog> {
  const rows = await db.select({ definition: componentVersions.definition }).from(componentVersions);
  return new MapCatalog(rows.map((r) => r.definition as ComponentDefinition));
}

async function processOne(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const rep = reporter(job.id, job.steps);
  rep.log(`worker ${WORKER_ID} picked up build ${job.id} (rev ${job.revision})`, "system");
  try {
    const [rev] = await db
      .select({ spec: projectRevisions.spec })
      .from(projectRevisions)
      .where(and(eq(projectRevisions.projectId, job.project_id), eq(projectRevisions.number, job.revision)));
    if (!rev) throw new Error(`revision ${job.revision} not found`);
    const files = await db.select({ path: projectFiles.path, content: projectFiles.content }).from(projectFiles).where(eq(projectFiles.projectId, job.project_id));
    const outcome = await runBuild(
      { buildId: job.id, spec: RobotSpec.parse(rev.spec), files },
      {
        catalog: await loadCatalog(),
        sandbox,
        nativeImage: process.env.SANDBOX_IMAGE ?? "roboforge/sandbox-native:1",
        pioImage: process.env.SANDBOX_PIO_IMAGE ?? "roboforge/sandbox-pio:1",
        pioNetwork: process.env.SANDBOX_PIO_NETWORK === "bridge" ? "bridge" : "none",
        timeoutMs: Number(process.env.SANDBOX_TIMEOUT_MS ?? 300_000),
      },
      rep,
    );
    let artifactKey: string | null = null;
    if (outcome.artifact) {
      artifactKey = `builds/${job.id}.zip`;
      await store.put(artifactKey, outcome.artifact);
    }
    rep.log(outcome.ok ? "BUILD SUCCEEDED" : `BUILD FAILED: ${outcome.error ?? ""}`, "system");
    await rep.flush();
    await db.update(builds).set({ status: outcome.ok ? "succeeded" : "failed", finishedAt: new Date(), artifactKey, error: outcome.ok ? null : outcome.error ?? null }).where(eq(builds.id, job.id));
  } catch (e) {
    rep.log(`internal error: ${(e as Error).message}`, "stderr");
    await rep.flush();
    await db.update(builds).set({ status: "failed", finishedAt: new Date(), error: (e as Error).message }).where(eq(builds.id, job.id));
  }
  return true;
}

async function main() {
  console.log(`[worker ${WORKER_ID}] polling for builds`);
  while (!stopping) {
    try {
      const did = await processOne();
      if (!did) await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (e) {
      console.error("[worker] loop error", e);
      await new Promise((r) => setTimeout(r, POLL_MS * 5));
    }
  }
  await getPool().end();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}: finishing current build then exiting`);
    stopping = true;
  });
}

main();
