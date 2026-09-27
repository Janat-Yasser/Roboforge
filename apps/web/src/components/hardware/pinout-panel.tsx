"use client";
import clsx from "clsx";
import { summarizeIR } from "@roboforge/ir";
import { useAnalysis, useProject } from "@/lib/store";
import { SIGNAL_COLOR, signalClass } from "./pin-style";

/** Derived wiring views: controller pin map, buses and power tree. Read-only — edit the wiring. */
export function PinoutPanel() {
  const analysis = useAnalysis();
  const select = useProject((s) => s.select);
  if (!analysis) return null;
  const s = summarizeIR(analysis.ir);
  const errPins = new Set(analysis.report.diagnostics.filter((d) => d.severity === "error").flatMap((d) => d.pins ?? []));
  const ctrlId = s.controller?.id;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-auto border-r border-border bg-panel">
      <div className="panel-title">Pin assignments {s.controller && <span className="normal-case text-faint">{s.controller.name}</span>}</div>
      {!s.controller ? (
        <p className="p-3 text-muted">Add a controller to see its pin map.</p>
      ) : (
        <table className="w-full text-[11.5px]" data-testid="pin-table">
          <thead>
            <tr className="text-left text-[10px] uppercase text-faint">
              <th className="px-3 py-1">Pin</th>
              <th className="py-1">Role</th>
              <th className="py-1 pr-3">Connected to</th>
            </tr>
          </thead>
          <tbody>
            {s.pinAssignments.map((p) => (
              <tr key={p.pin} className={clsx("border-t border-border/60 hover:bg-raised", (errPins.has(`${ctrlId}:${p.pin}`) || !p.supported) && "bg-err/10")}>
                <td className="px-3 py-1 font-mono">{p.pin}</td>
                <td className="py-1">
                  <span className="chip" style={{ color: SIGNAL_COLOR[signalClass(undefined, p.fn)], background: "color-mix(in srgb, currentColor 12%, transparent)" }}>
                    {p.fn ?? "conflict"}{p.bus && p.bus !== "*" ? ` · ${p.bus}` : ""}
                  </span>
                </td>
                <td className="py-1 pr-3 font-mono text-[11px]">
                  {p.devices.map((d) => (
                    <button key={`${d.componentId}.${d.pin}`} className="mr-1 hover:text-accent" onClick={() => select({ kind: "component", id: d.componentId })}>
                      {d.component}.{d.pin}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {s.i2cBuses.length > 0 && (
        <>
          <div className="panel-title mt-3 border-t">I²C buses</div>
          {s.i2cBuses.map((b) => (
            <div key={b.id} className="px-3 py-1.5 text-[11.5px]">
              <div className="font-mono text-sig-i2c">{b.id} · SDA {b.sda ?? "?"} · SCL {b.scl ?? "?"}</div>
              {b.devices.map((d) => (
                <div key={d.componentId} className="ml-2 font-mono text-muted">{d.address} {d.component}</div>
              ))}
            </div>
          ))}
        </>
      )}

      {s.canNetworks.length > 0 && (
        <>
          <div className="panel-title mt-3 border-t">CAN</div>
          {s.canNetworks.map((n) => (
            <div key={n.id} className="px-3 py-1.5 text-[11.5px]">
              <div className="font-mono text-sig-can">{n.id} · {n.bitrate} bit/s</div>
              {n.nodes.map((x) => <div key={x.componentId} className="ml-2 font-mono text-muted">#{x.nodeId} {x.component}</div>)}
            </div>
          ))}
        </>
      )}

      <div className="panel-title mt-3 border-t">Power</div>
      {s.power.length === 0 && <p className="px-3 py-1.5 text-muted">No power nets yet.</p>}
      {s.power.map((p) => (
        <div key={p.netId} className="px-3 py-1.5 text-[11.5px]">
          <div className="flex justify-between font-mono">
            <span className="text-sig-power">{p.net}</span>
            <span>{p.voltage !== undefined ? `${p.voltage} V` : "no source"}</span>
          </div>
          <div className="text-muted">
            load {p.loadTypicalMa} mA typ / {p.loadPeakMa} mA peak{p.sources[0]?.maxCurrentMa ? ` of ${p.sources[0].maxCurrentMa} mA` : ""}
          </div>
          {p.sources[0]?.maxCurrentMa ? (
            <div className="mt-1 h-1 rounded bg-raised">
              <div className={clsx("h-1 rounded", p.loadTypicalMa > p.sources[0].maxCurrentMa ? "bg-err" : p.loadPeakMa > p.sources[0].maxCurrentMa ? "bg-warn" : "bg-ok")} style={{ width: `${Math.min(100, (p.loadTypicalMa / p.sources[0].maxCurrentMa) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ))}

      <div className="panel-title mt-3 border-t">Motors</div>
      {s.motors.map((m) => (
        <div key={m.motorId} className="px-3 py-1 font-mono text-[11.5px]">
          {m.motor} <span className={m.binding.startsWith("unbound") ? "text-err" : "text-muted"}>→ {m.binding}</span>
        </div>
      ))}
    </aside>
  );
}
