// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * RoboForge database schema (Drizzle ORM, PostgreSQL).
 * The Robot Specification is stored as a versioned JSON document — see ARCHITECTURE.md, ADR-5.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ComponentDefinition, RobotSpec } from "@roboforge/spec";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

/** Opaque session tokens; only sha256(token) is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  personal: boolean("personal").notNull().default(false),
  createdAt: createdAt(),
});

export const roleEnum = pgEnum("role", ["owner", "admin", "member", "viewer"]);

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    /** Current spec — mirror of the latest revision. */
    spec: jsonb("spec").$type<RobotSpec>().notNull(),
    revision: integer("revision").notNull().default(1),
    /** Spec revision last generated into project_files. */
    generatedRevision: integer("generated_revision"),
    createdById: text("created_by_id").notNull().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_org_slug_uq").on(t.orgId, t.slug)],
);

/** Immutable snapshot of the spec and the commands that produced it. */
export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    spec: jsonb("spec").$type<RobotSpec>().notNull(),
    commands: jsonb("commands").$type<unknown[]>().notNull(),
    message: text("message"),
    authorId: text("author_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("revisions_project_number_uq").on(t.projectId, t.number)],
);

/** Reusable component library entry. orgId null = global built-in library. */
export const components = pgTable(
  "components",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull(),
    category: text("category").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    latestVersion: text("latest_version").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("components_category_idx").on(t.category)],
);

/** Published definitions are immutable. */
export const componentVersions = pgTable(
  "component_versions",
  {
    id: id(),
    componentId: text("component_id").notNull().references(() => components.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    definition: jsonb("definition").$type<ComponentDefinition>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("component_versions_uq").on(t.componentId, t.version)],
);

export const ownershipEnum = pgEnum("file_ownership", ["generated", "user", "mixed"]);

/** Materialized codebase: generated + engineer-owned files. */
export const projectFiles = pgTable(
  "project_files",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    ownership: ownershipEnum("ownership").notNull(),
    generator: text("generator"),
    specRevision: integer("spec_revision"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("project_files_path_uq").on(t.projectId, t.path)],
);

export const buildStatusEnum = pgEnum("build_status", ["queued", "running", "succeeded", "failed", "canceled"]);

export interface BuildStep {
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  detail?: string;
}

/** Build job — this table is also the job queue (claimed with FOR UPDATE SKIP LOCKED). */
export const builds = pgTable(
  "builds",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    status: buildStatusEnum("status").notNull().default("queued"),
    requestedById: text("requested_by_id").notNull().references(() => users.id),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    workerId: text("worker_id"),
    steps: jsonb("steps").$type<BuildStep[]>().notNull().default([]),
    artifactKey: text("artifact_key"),
    error: text("error"),
  },
  (t) => [index("builds_queue_idx").on(t.status, t.queuedAt), index("builds_project_idx").on(t.projectId, t.queuedAt)],
);

export const buildLogs = pgTable(
  "build_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    buildId: text("build_id").notNull().references(() => builds.id, { onDelete: "cascade" }),
    stream: text("stream").notNull().default("stdout"),
    line: text("line").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("build_logs_build_idx").on(t.buildId, t.id)],
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  org: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  revisions: many(projectRevisions),
  files: many(projectFiles),
  builds: many(builds),
}));
