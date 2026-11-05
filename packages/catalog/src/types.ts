// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { ComponentDefinition } from "@roboforge/spec";

/**
 * Catalog sources are written as loosely-typed literals (string enums) and parsed through the
 * ComponentDefinition zod schema at load time — so a malformed catalog entry fails fast in tests.
 */
export type PinDefInputLike = Record<string, unknown> & { name: string; type: string };
export type ComponentDefinitionInput = Record<string, unknown> & {
  id: string;
  version: string;
  pins: PinDefInputLike[];
};

export type { ComponentDefinition };
