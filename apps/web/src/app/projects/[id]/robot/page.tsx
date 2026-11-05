// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useEffect, useMemo, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { Check, RotateCcw } from "lucide-react";
import { parseSpecYaml, specToYaml, type DriveConfig } from "@roboforge/spec";
import { useAnalysis, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { CommitInput } from "@/components/hardware/properties-panel";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function RobotPage() {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const dispatch = useProject((s) => s.dispatch);
  const analysis = useAnalysis();
  const yaml = useMemo(() => specToYaml(spec), [spec]);
  const [draft, setDraft] = useState(yaml);
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  useEffect(() => setDraft(yaml), [yaml]);

  const controllers = spec.components.filter((c) => ["controller", "sbc"].includes(catalog.get(c.ref.catalogId, c.ref.version)?.category ?? ""));
  const motors = spec.components.filter((c) => catalog.get(c.ref.catalogId, c.ref.version)?.motor);
  const drive = spec.robot.drive;
  const setDrive = (d: DriveConfig | null) => dispatch([{ type: "robot.setDrive", drive: d }]);

  function applyYaml() {
    const r = parseSpecYaml(draft);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    if (dispatch([{ type: "spec.replace", spec: r.spec }], "Edit robot.yaml")) toast.ok("Specification updated from YAML.");
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[420px] shrink-0 space-y-5 overflow-auto border-r border-border bg-panel p-4">
        <section className="space-y-3">
          <h2 className="label">Robot</h2>
          <div>
            <label className="label">Display name</label>
            <CommitInput value={spec.robot.displayName} onCommit={(v) => v.trim() && dispatch([{ type: "robot.update", patch: { displayName: v.trim() } }])} />
          </div>
          <div>
            <label className="label">Code name (packages, namespaces)</label>
            <CommitInput className="input font-mono" value={spec.robot.name} onCommit={(v) => dispatch([{ type: "robot.update", patch: { name: v } }])} />
          </div>
          <div>
            <label className="label">Description</label>
            <CommitInput value={spec.robot.description} onCommit={(v) => dispatch([{ type: "robot.update", patch: { description: v } }])} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="label">Targets</h2>
          <div>
            <label className="label">Primary controller</label>
            <select className="input font-mono" value={spec.targets.controllerId ?? ""} onChange={(e) => dispatch([{ type: "targets.update", patch: { controllerId: e.target.value || null } }])}>
              <option value="">auto ({analysis?.ir.hardware.controller?.instance.name ?? "none"})</option>
              {controllers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={spec.targets.firmware.enabled} onChange={(e) => dispatch([{ type: "targets.update", patch: { firmwareEnabled: e.target.checked } }])} />
            Firmware (PlatformIO — ESP32 / Arduino / STM32)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={spec.targets.ros2.enabled} onChange={(e) => dispatch([{ type: "targets.update", patch: { ros2Enabled: e.target.checked } }])} data-testid="ros2-toggle" />
            ROS 2 packages
            <select className="input ml-auto w-28" value={spec.targets.ros2.distro} onChange={(e) => dispatch([{ type: "targets.update", patch: { ros2Distro: e.target.value as "jazzy" } }])}>
              <option value="jazzy">Jazzy</option>
              <option value="humble">Humble</option>
              <option value="rolling">Rolling</option>
            </select>
          </label>
          <p className="text-[11px] text-faint">Active generators: {analysis?.targets.join(", ")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="label">Differential drive</h2>
          {motors.length < 2 ? (
            <p className="text-[12px] text-muted">Add at least two motors to define a drive base.</p>
          ) : !drive ? (
            <button className="btn" onClick={() => setDrive({ kind: "differential", leftMotors: [motors[0]!.id], rightMotors: [motors[1]!.id], wheelRadiusM: 0.035, trackWidthM: 0.18, maxSpeedMps: 0.5 })}>Define drive base</button>
          ) : (
            <>
              {(["leftMotors", "rightMotors"] as const).map((side) => (
                <div key={side}>
                  <label className="label">{side === "leftMotors" ? "Left" : "Right"} motors</label>
                  <div className="flex flex-wrap gap-2">
                    {motors.map((m) => (
                      <label key={m.id} className="flex items-center gap-1 font-mono text-[12px]">
                        <input
                          type="checkbox"
                          checked={drive[side].includes(m.id)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...drive[side], m.id] : drive[side].filter((x) => x !== m.id);
                            if (next.length) setDrive({ ...drive, [side]: next });
                          }}
                        />
                        {m.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                {([["wheelRadiusM", "Wheel r (m)"], ["trackWidthM", "Track (m)"], ["maxSpeedMps", "Max m/s"]] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className="label">{l}</label>
                    <CommitInput className="input font-mono" value={String(drive[k])} onCommit={(v) => Number(v) > 0 && setDrive({ ...drive, [k]: Number(v) })} />
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost text-err" onClick={() => setDrive(null)}>Remove drive base</button>
            </>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="panel-title">
          robot.yaml — Robot Specification (source of truth)
          <div className="flex gap-1.5 normal-case">
            <button className="btn" onClick={() => { setDraft(yaml); setErrors([]); }} disabled={draft === yaml}><RotateCcw className="size-3.5" /> Revert</button>
            <button className="btn btn-primary" onClick={applyYaml} disabled={draft === yaml}><Check className="size-3.5" /> Apply</button>
          </div>
        </div>
        {errors.length > 0 && (
          <div className="border-b border-err/40 bg-err/10 px-3 py-1.5 text-[12px] text-err">
            {errors.slice(0, 5).map((e, i) => <div key={i}><span className="font-mono">{e.path || "yaml"}</span>: {e.message}</div>)}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Editor theme="vs-dark" language="yaml" value={draft} onChange={(v) => setDraft(v ?? "")} options={{ fontSize: 12.5, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2 }} />
        </div>
      </div>
    </div>
  );
}
