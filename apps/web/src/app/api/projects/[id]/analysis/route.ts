import { analyzeProject } from "@roboforge/codegen";
import { summarizeIR } from "@roboforge/ir";
import { RobotSpec } from "@roboforge/spec";
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getCatalog } from "@/server/services/catalog";
import { getProjectForUser } from "@/server/services/projects";

/** Server-side analysis (same code the browser runs) — for API clients, CI and the AI assistant. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const p = await getProjectForUser(await requireUser(), params.id);
  const a = analyzeProject(RobotSpec.parse(p.spec), await getCatalog());
  return { revision: p.revision, report: a.report, targets: a.targets, ir: summarizeIR(a.ir) };
});
