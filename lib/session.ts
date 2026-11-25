import "server-only";
import { cookies, headers } from "next/headers";
import { sign, unsign } from "./crypto";
import { db } from "./storage";

export type Role = "hero" | "admin";
const COOKIE: Record<Role, string> = { hero: "bd_hero", admin: "bd_admin" };
const MAX_AGE: Record<Role, number> = { hero: 60 * 60 * 24 * 30, admin: 60 * 60 * 12 };

export async function setSession(role: Role) {
  const exp = Date.now() + MAX_AGE[role] * 1000;
  const jar = await cookies();
  jar.set(COOKIE[role], sign(`${role}:${exp}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE[role],
  });
}

export async function clearSession(role: Role) {
  (await cookies()).delete(COOKIE[role]);
}

export async function hasRole(role: Role): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE[role])?.value;
  if (!raw) return false;
  const payload = unsign(raw);
  if (!payload) return false;
  const [r, exp] = payload.split(":");
  return r === role && Number(exp) > Date.now();
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

/** Returns true if the caller is allowed to proceed. */
export async function rateLimit(bucket: string, max: number, windowSec: number): Promise<boolean> {
  const ip = await clientIp();
  const n = await db().incr(`rl:${bucket}:${ip}`, windowSec);
  return n <= max;
}
