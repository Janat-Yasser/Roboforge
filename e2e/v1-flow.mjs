/**
 * End-to-end check of the V1 vertical slice, driven through the real UI:
 * create project → add ESP32, two motors, motor driver, distance sensor (+ power, e-stop)
 * → wire (manual + auto) → validation catches a mistake → fix → build obstacle-avoidance behavior
 * → generate → inspect code → build (sandboxed tests) → export zip.
 *
 *   BASE_URL=http://localhost:3000 SHOTS=/tmp/shots node e2e/v1-flow.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(SHOTS, { recursive: true });
const step = (m) => console.log(`\n▶ ${m}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
/** Canvas node by exact instance name. */
const node = (name) => page.locator(".react-flow__node").filter({ has: page.locator("div.font-mono", { hasText: new RegExp(`^${name}$`) }) }).first();
const handle = (text, id) => node(text).locator(`.react-flow__handle[data-handleid="${id}"]`);
async function drag(from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
const statusText = () => page.locator("[data-testid=problems-toggle]").innerText();

step("Sign up and create a blank project");
await page.goto(`${BASE}/signup`);
await page.fill("#name", "E2E Engineer");
await page.fill("#email", `e2e-${Date.now()}@example.com`);
await page.fill("#password", "e2e-password-123");
await page.click("button:has-text('Create account')");
await page.waitForURL("**/projects");
await page.click("text=New project");
await page.fill("input[placeholder='My Autonomous Warehouse Robot']", "My Autonomous Warehouse Robot");
await page.click("text=Blank robot");
await page.click("button:has-text('Create project')");
await page.waitForURL("**/overview");

step("Hardware: add ESP32, two motors, motor driver, distance sensor, battery, 5 V buck, e-stop");
await page.click("nav >> text=Hardware");
for (const id of ["lipo-2s-2200", "lm2596-buck", "esp32-devkitc", "tb6612fng-breakout", "dc-gearmotor-12v", "dc-gearmotor-12v", "vl53l0x-breakout", "estop-button-nc"]) {
  await page.locator(`[data-testid=add-${id}]`).click({ force: true });
  await page.waitForTimeout(300);
}
await page.click(".react-flow__controls-fitview");
await page.waitForTimeout(500);
console.log("  components on canvas:", await page.locator(".react-flow__node").count());

step("Wire power by hand, then auto-wire the rest");
await drag(handle("regulator", "VIN"), handle("battery", "BAT+"));
await drag(handle("regulator", "GND_IN"), handle("battery", "BAT-"));
for (const name of ["regulator", "mcu", "motor_driver", "motor", "motor_2"]) {
  await node(name).locator("div").first().click();
  await page.click("[data-testid=autowire]");
  await page.waitForTimeout(400);
}

step("Deliberate mistake: power the ToF sensor from 5 V (its I²C pulls up to VIN)");
await drag(handle("range_sensor", "VIN"), handle("regulator", "VOUT"));
await node("range_sensor").locator("div").first().click();
await page.click("[data-testid=autowire]");
await page.waitForTimeout(600);
console.log("  status:", await statusText());
await page.click("[data-testid=problems-toggle]");
await page.waitForTimeout(300);
await shot("01-validation-error");
const logicErr = await page.locator("text=LOGIC_LEVEL_MISMATCH").count();
console.log("  LOGIC_LEVEL_MISMATCH shown:", logicErr > 0);
await page.click("[data-testid=problems-toggle]");

step("Fix: remove the 5 V wire and power the sensor from 3V3");
await node("range_sensor").locator("div").first().click();
await page.locator("aside button", { hasText: "VIN → regulator.VOUT" }).click();
await page.click("button:has-text('Disconnect')");
await node("range_sensor").locator("div").first().click();
await page.click("[data-testid=autowire]");
await node("estop").locator("div").first().click();
await page.click("[data-testid=autowire]");
await page.waitForTimeout(800);
console.log("  status:", await statusText());
await shot("02-hardware");

step("Wiring view: derived pin assignments, buses and power budget");
await page.click("nav >> text=Wiring");
await page.waitForTimeout(1200);
await shot("03-wiring");
console.log("  pin rows:", await page.locator("[data-testid=pin-table] tbody tr").count());

step("Behavior: obstacle avoidance built from the palette");
await page.click("nav >> text=Behavior");
await page.waitForTimeout(800);
for (const k of ["event.start", "sensor.read", "condition", "motor.stop", "delay", "motor.set", "delay"]) {
  await page.locator(`[data-testid="palette-${k}"]`).dblclick();
  await page.waitForTimeout(250);
}
await page.click(".react-flow__controls-fitview");
await page.waitForTimeout(400);
const b = (title, i = 0) => page.locator(".react-flow__node", { hasText: title }).nth(i);
const out = (title, port, i = 0) => b(title, i).locator(`.react-flow__handle[data-handleid="${port}"]`);
const inn = (title, i = 0) => b(title, i).locator(`.react-flow__handle[data-handleid="in"]`);
await drag(out("Robot Started", "next"), inn("Read Sensor"));
await drag(out("Read Sensor", "next"), inn("Condition"));
await drag(out("Condition", "true"), inn("Stop Motors"));
await drag(out("Stop Motors", "next"), inn("Wait", 0));
await drag(out("Wait", "next", 0), inn("Read Sensor"));
await drag(out("Condition", "false"), inn("Set Motors"));
await drag(out("Set Motors", "next"), inn("Wait", 1));
await drag(out("Wait", "next", 1), inn("Read Sensor"));
await page.waitForTimeout(800);
await page.click(".react-flow__controls-fitview");
await b("Condition").click();
await page.waitForTimeout(400);
await shot("04-behavior");
console.log("  edges:", await page.locator(".react-flow__edge").count(), " status:", await statusText());

step("Generate code and inspect it");
await page.click("button:has-text('Generate')");
await page.waitForURL("**/code", { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click("text=behavior.cpp");
await page.waitForTimeout(2500);
await shot("05-code-behavior");
await page.click("text=main.cpp");
await page.waitForTimeout(1500);
await shot("06-code-mixed");

step("Build: validation, sandboxed native tests + ROS 2 tests, package");
await page.click("nav >> text=Build & Tests");
await page.click("[data-testid=start-build]");
await page.locator("[data-testid=build-log]").getByText(/BUILD (SUCCEEDED|FAILED)/).waitFor({ timeout: 180000 });
await page.waitForTimeout(1000);
await shot("07-build");
console.log("  result:", await page.locator("[data-testid=build-log]").getByText(/BUILD (SUCCEEDED|FAILED)/).innerText());

step("Export the Git-ready project");
const [download] = await Promise.all([page.waitForEvent("download"), page.click("button:has-text('Export')")]);
const zipPath = `${SHOTS}/${download.suggestedFilename()}`;
await download.saveAs(zipPath);
console.log("  exported:", zipPath);

await page.click("nav >> text=Docs");
await page.click("text=Wiring & power");
await page.waitForTimeout(3500);
await shot("08-docs");
await page.click("nav >> text=Overview");
await page.waitForTimeout(1500);
await shot("09-overview");

writeFileSync(`${SHOTS}/errors.json`, JSON.stringify(errors, null, 2));
console.log(`\nbrowser errors: ${errors.length}`);
await browser.close();
