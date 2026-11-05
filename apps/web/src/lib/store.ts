// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useMemo } from "react";
import { create } from "zustand";
import { analyzeProject, type Analysis } from "@roboforge/codegen";
import { applyCommands, CommandError, MapCatalog, type Command, type ComponentDefinition, type RobotSpec } from "@roboforge/spec";
import { api, ApiClientError } from "./api";
import { builtinCatalog, demoSpec } from "./demo";
import { toast } from "./toast";

export type Selection =
  | { kind: "component"; id: string }
  | { kind: "connection"; id: string }
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

interface ProjectMeta {
  id: string;
  name: string;
  revision: number;
  generatedRevision: number | null;
}

interface ProjectStore {
  /** "demo" = public, unsaved sandbox project that lives only in this browser tab. */
  mode: "project" | "demo";
  project: ProjectMeta | null;
  spec: RobotSpec | null;
  /** Revision confirmed by the server for the last acknowledged batch. */
  revision: number;
  catalog: MapCatalog;
  catalogVersion: number;
  selection: Selection | null;
  pending: number;
  loadError: string | null;

  load(projectId: string): Promise<void>;
  loadDemo(): void;
  reload(): Promise<void>;
  addDefinitions(defs: ComponentDefinition[]): void;
  /** Applies commands optimistically and persists them. Returns false if rejected locally. */
  dispatch(commands: Command[], message?: string): boolean;
  select(sel: Selection | null): void;
  setGeneratedRevision(rev: number): void;
}

let queue: Promise<unknown> = Promise.resolve();

export const DEMO_ID = "demo";

export const useProject = create<ProjectStore>((set, get) => ({
  mode: "project",
  project: null,
  spec: null,
  revision: 0,
  catalog: new MapCatalog([]),
  catalogVersion: 0,
  selection: null,
  pending: 0,
  loadError: null,

  loadDemo() {
    const spec = demoSpec();
    set((s) => ({
      mode: "demo",
      project: { id: DEMO_ID, name: spec.robot.displayName, revision: 1, generatedRevision: null },
      spec,
      revision: 1,
      catalog: new MapCatalog(builtinCatalog().all()),
      catalogVersion: s.catalogVersion + 1,
      selection: null,
      loadError: null,
    }));
  },

  async load(projectId) {
    set({ mode: "project", project: null, spec: null, selection: null, loadError: null });
    try {
      const [{ project, spec }, lib] = await Promise.all([
        api<{ project: ProjectMeta; spec: RobotSpec }>(`/api/projects/${projectId}`),
        api<{ components: ComponentDefinition[] }>(`/api/components`),
      ]);
      const refs = spec.components.map((c) => `${c.ref.catalogId}@${c.ref.version}`).join(",");
      const pinned = refs ? await api<{ components: ComponentDefinition[] }>(`/api/components?refs=${encodeURIComponent(refs)}`) : { components: [] };
      const catalog = new MapCatalog([...lib.components, ...pinned.components]);
      set((s) => ({ project, spec, revision: project.revision, catalog, catalogVersion: s.catalogVersion + 1 }));
    } catch (e) {
      set({ loadError: (e as Error).message });
    }
  },

  async reload() {
    const p = get().project;
    if (!p || get().mode === "demo") return;
    const { project, spec } = await api<{ project: ProjectMeta; spec: RobotSpec }>(`/api/projects/${p.id}`);
    set({ project, spec, revision: project.revision });
  },

  addDefinitions(defs) {
    const cat = get().catalog;
    let added = false;
    for (const d of defs) {
      if (!cat.get(d.id, d.version)) {
        cat.add(d);
        added = true;
      }
    }
    if (added) set((s) => ({ catalogVersion: s.catalogVersion + 1 }));
  },

  dispatch(commands, message) {
    const { spec, catalog, project } = get();
    if (!spec || !project || !commands.length) return false;
    let next: RobotSpec;
    try {
      next = applyCommands(spec, commands, { catalog });
    } catch (e) {
      toast.error(e instanceof CommandError ? e.message : (e as Error).message);
      return false;
    }
    if (get().mode === "demo") {
      set((s) => ({ spec: next, revision: s.revision + 1, project: s.project ? { ...s.project, revision: s.revision + 1, name: next.robot.displayName } : s.project }));
      return true;
    }
    set((s) => ({ spec: next, pending: s.pending + 1 }));
    queue = queue.then(async () => {
      try {
        const res = await api<{ revision: number; spec: RobotSpec }>(`/api/projects/${project.id}/commands`, {
          method: "POST",
          json: { baseRevision: get().revision, commands, message },
        });
        set((s) => ({
          revision: res.revision,
          project: s.project ? { ...s.project, revision: res.revision, name: res.spec.robot.displayName } : s.project,
          // Adopt the authoritative spec once no other local batches are in flight.
          spec: s.pending === 1 ? res.spec : s.spec,
        }));
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 409) toast.error("The project was changed elsewhere — reloaded the latest revision.");
        else toast.error(`Change rejected: ${(e as Error).message}`);
        await get().reload();
      } finally {
        set((s) => ({ pending: s.pending - 1 }));
      }
    });
    return true;
  },

  select(sel) {
    set({ selection: sel });
  },

  setGeneratedRevision(rev) {
    set((s) => ({ project: s.project ? { ...s.project, generatedRevision: rev } : s.project }));
  },
}));

/** Validation + IR for the current spec, computed in the browser with the same engine as the server. */
export function useAnalysis(): Analysis | null {
  const spec = useProject((s) => s.spec);
  const catalog = useProject((s) => s.catalog);
  const version = useProject((s) => s.catalogVersion);
  return useMemo(() => {
    if (!spec) return null;
    try {
      return analyzeProject(spec, catalog);
    } catch (e) {
      console.error("analysis failed", e);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, catalog, version]);
}

/** Waits until all queued command batches have been persisted. */
export function flushCommands(): Promise<unknown> {
  return queue;
}

/** URL prefix for workspace pages: /projects/<id> or /demo. */
export function useBasePath(): string {
  const mode = useProject((s) => s.mode);
  const id = useProject((s) => s.project?.id);
  return mode === "demo" ? "/demo" : `/projects/${id ?? ""}`;
}

export function useIsDemo(): boolean {
  return useProject((s) => s.mode === "demo");
}
