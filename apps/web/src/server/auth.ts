// Copyright (c) 2026 Janat Yasser. All rights reserved.
import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, memberships, organizations, sessions, users } from "@roboforge/db";
import { ApiError, unauthorized } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "rf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb().insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  const [m] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, row.id), eq(organizations.personal, true)));
  if (!m) return null;
  return { ...row, orgId: m.orgId };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw unauthorized();
  return u;
}

/** Creates a user with a personal organization. */
export async function signUp(input: { email: string; name: string; password: string }): Promise<string> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, name: input.name.trim(), passwordHash }).returning({ id: users.id });
    const [o] = await tx
      .insert(organizations)
      .values({ name: `${input.name.trim()}'s workspace`, slug: `u-${u!.id.slice(0, 8)}`, personal: true })
      .returning({ id: organizations.id });
    await tx.insert(memberships).values({ userId: u!.id, orgId: o!.id, role: "owner" });
    return u!.id;
  });
}

export async function logIn(email: string, password: string): Promise<string> {
  const [u] = await getDb().select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  // Always run scrypt to keep timing uniform for unknown emails.
  const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!u || !ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  return u.id;
}
