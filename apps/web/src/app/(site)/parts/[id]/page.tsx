import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { PartGlyph } from "@/components/parts/part-glyph";
import { CATEGORY_COLOR, SIGNAL_COLOR, signalClass } from "@/components/hardware/pin-style";
import { Reveal } from "@/components/ui/reveal";
import { publicParts } from "@/server/services/public-catalog";

async function find(id: string) {
  return (await publicParts()).find((p) => p.id === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await find((await params).id))?.name ?? "Part" };
}

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await find((await params).id);
  if (!p) notFound();
  const supply = p.pins.filter((x) => x.type === "power_in" && x.voltage).map((x) => `${x.name}: ${x.voltage!.min}–${x.voltage!.max} V`);
  const specs: [string, string][] = [
    ["Category", p.category.replace("_", " ")],
    ["Interfaces", p.interfaces.join(", ") || "—"],
    ["Supply", supply.join(" · ") || "—"],
    ["Typical current", p.electrical.typicalCurrentMa ? `${p.electrical.typicalCurrentMa} mA` : "—"],
    ...(p.electrical.logicLevelV ? ([["Logic level", `${p.electrical.logicLevelV} V`]] as [string, string][]) : []),
    ...(p.i2c ? ([["I²C address", `${hex(p.i2c.defaultAddress)} (default)`]] as [string, string][]) : []),
    ...(p.motor ? ([["Rated voltage", `${p.motor.ratedVoltage.min}–${p.motor.ratedVoltage.max} V`], ["Stall current", `${p.motor.stallCurrentMa} mA`]] as [string, string][]) : []),
    ...(p.power?.kind === "battery" ? ([["Voltage", `${p.power.nominalV} V nominal, ${p.power.fullV} V full`], ["Capacity", `${p.power.capacityMah} mAh`]] as [string, string][]) : []),
    ...(p.sensor ? ([["Measures", p.sensor.channels.map((c) => `${c.label} (${c.unit})`).join(", ")]] as [string, string][]) : []),
  ];
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      <Link href="/parts" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[14px] font-semibold text-muted hover:bg-raised hover:text-fg"><ArrowLeft className="size-4" /> Parts library</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[400px_1fr]">
        <Reveal>
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[32px]" style={{ background: `color-mix(in srgb, ${CATEGORY_COLOR[p.category]} 16%, var(--rf-panel))` }}><span className="absolute -right-10 -top-10 size-40 rounded-full opacity-25" style={{ background: CATEGORY_COLOR[p.category] }} /><span className="absolute bottom-6 left-6 size-12 rotate-12 rounded-2xl opacity-25" style={{ background: CATEGORY_COLOR[p.category] }} />
            <PartGlyph def={p} size={240} />
          </div>
          <Link href="/signup" className="btn-ink mt-6 w-full">Use it in a robot <ArrowRight className="size-4" /></Link>
          {p.datasheetUrl && (
            <a href={p.datasheetUrl} target="_blank" rel="noreferrer" className="btn-line mt-3 w-full">Datasheet <ExternalLink className="size-3.5" /></a>
          )}
        </Reveal>
        <Reveal delay={0.08}>
          <div className="flex items-center gap-2"><span className="rounded-full px-3 py-1 text-[12.5px] font-bold text-white" style={{ background: CATEGORY_COLOR[p.category] }}>{p.category.replace("_", " ")}</span><span className="text-[14px] font-semibold text-muted">{p.manufacturer}</span></div>
          <h1 className="display mt-4 text-[40px] sm:text-[54px]">{p.name}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">{p.description}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {specs.map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-border bg-panel p-4 shadow-[var(--rf-shadow)]">
                <div className="text-[12.5px] font-bold text-muted">{k}</div>
                <div className="mt-1 text-[15.5px] font-bold">{v}</div>
              </div>
            ))}
          </div>
          <h2 className="display mt-12 text-[30px]">Pinout <span className="text-muted">· {p.pins.length} pins</span></h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel shadow-[var(--rf-shadow)]">
            <table className="w-full text-[13px]">
              <thead className="bg-panel-2 text-left text-[12.5px] font-bold text-muted">
                <tr className="border-b border-border"><th className="py-3 pl-5 pr-4">Pin</th><th className="py-2">Type</th><th className="py-2 pr-4">Can do / notes</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.pins.map((pin) => (
                  <tr key={pin.name}>
                    <td className="py-2.5 pl-5 pr-4 font-mono font-semibold">
                      <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: SIGNAL_COLOR[signalClass(pin.type)] }} />
                      {pin.label ?? pin.name}
                    </td>
                    <td className="py-2 text-muted">{pin.type.replace("_", " ")}</td>
                    <td className="py-2 pr-4 text-muted">
                      {[
                        pin.functions?.map((f) => f.fn).filter((f, i, a) => a.indexOf(f) === i).join(", "),
                        pin.voltage ? `${pin.voltage.min}–${pin.voltage.max} V` : "",
                        pin.outputVoltage ? `${pin.outputVoltage} V out` : "",
                        pin.flags?.length ? `⚠ ${pin.flags.join(", ")}` : "",
                        pin.notes ?? "",
                      ].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
