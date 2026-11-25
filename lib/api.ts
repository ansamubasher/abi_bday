import "server-only";
import { NextResponse } from "next/server";
import { hasRole } from "./session";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (status: number, error: string) => json({ error }, status);

export async function requireAdmin() {
  return (await hasRole("admin")) ? null : fail(401, "Not signed in.");
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
