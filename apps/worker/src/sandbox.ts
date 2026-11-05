// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface SandboxRunOptions {
  image: string;
  /** Host directory mounted read-only at /work. */
  workspace: string;
  script: string;
  timeoutMs: number;
  network?: "none" | "bridge";
  onLine: (line: string, stream: "stdout" | "stderr") => void;
}

export interface SandboxResult {
  exitCode: number;
  timedOut: boolean;
}

export interface Sandbox {
  /** Why the sandbox cannot run this image, or null if it can. */
  unavailableReason(image: string): string | null;
  run(opts: SandboxRunOptions): Promise<SandboxResult>;
}

/**
 * Runs untrusted build/test commands in a throwaway container:
 * no network (by default), read-only root and workspace, tmpfs scratch, all capabilities dropped,
 * no privilege escalation, unprivileged user, CPU/memory/PID limits and a wall-clock timeout.
 * Nothing from a generated or user-edited project ever executes on the worker host itself.
 */
export class DockerSandbox implements Sandbox {
  constructor(private readonly docker = process.env.DOCKER_BIN ?? "docker") {}

  unavailableReason(image: string): string | null {
    const info = spawnSync(this.docker, ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 10_000 });
    if (info.status !== 0) return "no container runtime available on this worker (docker daemon unreachable)";
    const img = spawnSync(this.docker, ["image", "inspect", image], { encoding: "utf8", timeout: 10_000 });
    if (img.status !== 0) return `sandbox image '${image}' is not installed on this worker (see infra/sandbox)`;
    return null;
  }

  run(o: SandboxRunOptions): Promise<SandboxResult> {
    const name = `rf-sbx-${randomUUID().slice(0, 12)}`;
    const args = [
      "run", "--rm", "--name", name,
      "--network", o.network ?? "none",
      "--cpus", "1", "--memory", "1g", "--memory-swap", "1g", "--pids-limit", "256",
      "--read-only", "--tmpfs", "/tmp:rw,exec,nosuid,size=512m,mode=1777",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--user", "10001:10001",
      "-e", "HOME=/tmp", "-e", "PYTHONDONTWRITEBYTECODE=1",
      "-v", `${o.workspace}:/work:ro`, "-w", "/work",
      o.image, "bash", "-c", o.script,
    ];
    return new Promise((resolve) => {
      const child = spawn(this.docker, args, { stdio: ["ignore", "pipe", "pipe"] });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        spawnSync(this.docker, ["kill", name]);
      }, o.timeoutMs);
      const pipe = (stream: NodeJS.ReadableStream, kind: "stdout" | "stderr") => {
        let buf = "";
        stream.on("data", (d: Buffer) => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            o.onLine(buf.slice(0, i), kind);
            buf = buf.slice(i + 1);
          }
        });
        stream.on("end", () => buf && o.onLine(buf, kind));
      };
      pipe(child.stdout!, "stdout");
      pipe(child.stderr!, "stderr");
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, timedOut });
      });
    });
  }
}
