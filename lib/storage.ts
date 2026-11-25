import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

/** Tiny KV abstraction: Upstash Redis in production, a JSON file locally. */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSec: number): Promise<number>;
}

class RedisKV implements KV {
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    const v = await this.r.get<T>(key);
    return v ?? null;
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    if (ttlSec) await this.r.set(key, value, { ex: ttlSec });
    else await this.r.set(key, value);
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async incr(key: string, ttlSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
}

type FileShape = Record<string, { v: unknown; exp?: number }>;

class FileKV implements KV {
  private file = path.join(process.cwd(), ".data", "db.json");
  private read(): FileShape {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  private write(d: FileShape) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(d, null, 2));
  }
  async get<T>(key: string) {
    const e = this.read()[key];
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) return null;
    return e.v as T;
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    const d = this.read();
    d[key] = { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined };
    this.write(d);
  }
  async del(key: string) {
    const d = this.read();
    delete d[key];
    this.write(d);
  }
  async incr(key: string, ttlSec: number) {
    const d = this.read();
    const e = d[key];
    const live = e && (!e.exp || e.exp > Date.now());
    const n = live ? Number(e.v) + 1 : 1;
    d[key] = { v: n, exp: live ? e.exp : Date.now() + ttlSec * 1000 };
    this.write(d);
    return n;
  }
}

let kv: KV | null = null;

export function db(): KV {
  if (kv) return kv;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    kv = new RedisKV(new Redis({ url, token }));
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No Redis configured. Add the Upstash Redis integration in Vercel (Storage tab)."
      );
    }
    kv = new FileKV();
  }
  return kv;
}
