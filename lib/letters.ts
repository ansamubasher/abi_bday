import "server-only";
import { db } from "./storage";
import { decrypt, encrypt, hashToken, randomToken } from "./crypto";

export const MAX_WRITERS = 22;
export const MAX_BODY = 8000;

export type Writer = {
  id: string;
  slot: number; // 0..21: which lantern this person's letter is behind
  name: string; // organiser-only label
  tokenHash: string;
  tokenEnc: string; // so the organiser can re-copy links
  createdAt: number;
};

export type Letter = { body: string; from: string; updatedAt: number };

const WRITERS = "writers";
const LOCK = "config:locked";

export async function listWriters(): Promise<Writer[]> {
  return (await db().get<Writer[]>(WRITERS)) ?? [];
}
async function saveWriters(w: Writer[]) {
  await db().set(WRITERS, w);
}

export async function createWriters(names: string[]): Promise<Writer[]> {
  const writers = await listWriters();
  const used = new Set(writers.map((w) => w.slot));
  for (const raw of names) {
    const name = raw.trim().slice(0, 60);
    if (!name || writers.length >= MAX_WRITERS) continue;
    let slot = 0;
    while (used.has(slot)) slot++;
    used.add(slot);
    const token = randomToken();
    writers.push({
      id: randomToken().slice(0, 12),
      slot,
      name,
      tokenHash: hashToken(token),
      tokenEnc: encrypt(token),
      createdAt: Date.now(),
    });
  }
  writers.sort((a, b) => a.slot - b.slot);
  await saveWriters(writers);
  return writers;
}

export async function writerByToken(token: string): Promise<Writer | null> {
  if (!token || token.length < 20 || token.length > 80) return null;
  const h = hashToken(token);
  return (await listWriters()).find((w) => w.tokenHash === h) ?? null;
}

export async function updateWriter(id: string, patch: { name?: string; regen?: boolean }) {
  const writers = await listWriters();
  const w = writers.find((x) => x.id === id);
  if (!w) return null;
  if (patch.name) w.name = patch.name.trim().slice(0, 60);
  if (patch.regen) {
    const token = randomToken();
    w.tokenHash = hashToken(token);
    w.tokenEnc = encrypt(token);
  }
  await saveWriters(writers);
  return w;
}

export async function deleteWriter(id: string) {
  const writers = await listWriters();
  await saveWriters(writers.filter((w) => w.id !== id));
  await db().del(`letter:${id}`);
}

export function writerToken(w: Writer): string {
  return decrypt(w.tokenEnc);
}

export async function getLetter(writerId: string): Promise<Letter | null> {
  const blob = await db().get<string>(`letter:${writerId}`);
  if (!blob) return null;
  try {
    return JSON.parse(decrypt(blob)) as Letter;
  } catch {
    return null;
  }
}

export async function saveLetter(writerId: string, body: string, from: string) {
  const letter: Letter = {
    body: body.slice(0, MAX_BODY),
    from: from.slice(0, 60),
    updatedAt: Date.now(),
  };
  await db().set(`letter:${writerId}`, encrypt(JSON.stringify(letter)));
  return letter;
}

/** What the organiser may know: whether a letter exists and roughly how long. Never the text. */
export async function letterMeta(writerId: string) {
  const l = await getLetter(writerId);
  if (!l || !l.body.trim()) return { written: false, words: 0, updatedAt: null as number | null };
  return {
    written: true,
    words: l.body.trim().split(/\s+/).length,
    updatedAt: l.updatedAt,
  };
}

export async function isLocked(): Promise<boolean> {
  return (await db().get<boolean>(LOCK)) === true;
}
export async function setLocked(v: boolean) {
  await db().set(LOCK, v);
}

export async function letterForSlot(slot: number): Promise<Letter | null> {
  const w = (await listWriters()).find((x) => x.slot === slot);
  if (!w) return null;
  const l = await getLetter(w.id);
  return l && l.body.trim() ? l : null;
}
