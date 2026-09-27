import { describe, expect, it } from "vitest";
import { applyCommands } from "@roboforge/spec";
import { createFromTemplate } from "@roboforge/ir";
import { runAssistant, type LlmClient, type LlmRequest, type LlmResponse } from "@roboforge/assistant";
import { catalog } from "../../ir/test/helpers";

/** Scripted model: replays tool calls and records what it was sent. */
class ScriptedClient implements LlmClient {
  requests: LlmRequest[] = [];
  constructor(private readonly script: LlmResponse[]) {}
  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(structuredClone(req));
    return this.script.shift() ?? { content: [{ type: "text", text: "done" }], stop_reason: "end_turn" };
  }
}

const use = (id: string, name: string, input: unknown) => ({ type: "tool_use" as const, id, name, input });

describe("assistant", () => {
  it("adds an IMU through tools and returns a reviewable proposal", async () => {
    const spec = createFromTemplate("obstacle-avoider", catalog, "bot", "Bot");
    const client = new ScriptedClient([
      { content: [use("1", "search_components", { query: "imu" })], stop_reason: "tool_use" },
      { content: [use("2", "add_component", { catalogId: "mpu6050-gy521", name: "imu" }), use("3", "auto_wire", { component: "imu" })], stop_reason: "tool_use" },
      { content: [use("4", "validate", {})], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "Added an MPU-6050 on i2c0 (0x68), sharing SDA/SCL with the ToF." }], stop_reason: "end_turn" },
    ]);
    const r = await runAssistant({ spec, catalog: catalog as never, prompt: "Add an IMU to the robot.", client });
    expect(r.reply).toMatch(/MPU-6050/);
    expect(r.toolCalls.every((t) => t.ok)).toBe(true);
    expect(r.after.errors).toBe(0);
    // The input spec is untouched; the proposal replays cleanly onto it.
    expect(spec.components.some((c) => c.name === "imu")).toBe(false);
    const applied = applyCommands(spec, r.commands, { catalog });
    expect(applied).toEqual(r.proposedSpec);
    // Tool results were fed back to the model.
    const last = client.requests.at(-1)!;
    expect(JSON.stringify(last.messages)).toContain("tool_result");
  });

  it("reports tool errors to the model instead of throwing", async () => {
    const spec = createFromTemplate("blank", catalog, "bot", "Bot");
    const client = new ScriptedClient([{ content: [use("1", "connect", { from: "nope.X", to: "mcu.GPIO1" })], stop_reason: "tool_use" }]);
    const r = await runAssistant({ spec, catalog: catalog as never, prompt: "wire it", client });
    expect(r.toolCalls[0]!.ok).toBe(false);
    expect(r.commands).toEqual([]);
  });
});
