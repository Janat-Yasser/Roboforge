// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/** Object storage for build artifacts. V1 ships a local-filesystem store; S3 implements the same interface. */
export interface ObjectStore {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class LocalObjectStore implements ObjectStore {
  private readonly root: string;

  constructor(root = process.env.ARTIFACT_DIR ?? ".data/artifacts") {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error(`Invalid object key '${key}'.`);
    return p;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
}
