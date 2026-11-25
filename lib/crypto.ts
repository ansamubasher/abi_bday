import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

const letterKey = () => crypto.createHash("sha256").update(env("LETTER_SECRET")).digest();

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", letterKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, ct] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", letterKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export function randomToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Writer tokens are looked up by HMAC so the database never holds a usable token. */
export function hashToken(token: string): string {
  return crypto.createHmac("sha256", env("SESSION_SECRET")).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function sign(payload: string): string {
  const mac = crypto.createHmac("sha256", env("SESSION_SECRET")).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const payload = signed.slice(0, i);
  const expected = sign(payload);
  return safeEqual(expected, signed) ? payload : null;
}
