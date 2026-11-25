/** Tiny typed-ish event bus between the Phaser scene and the React shell. */
type Fn = (...a: any[]) => void;
const map = new Map<string, Set<Fn>>();

export const bus = {
  on(evt: string, fn: Fn) {
    if (!map.has(evt)) map.set(evt, new Set());
    map.get(evt)!.add(fn);
    return () => map.get(evt)?.delete(fn);
  },
  emit(evt: string, ...a: any[]) {
    map.get(evt)?.forEach((f) => f(...a));
  },
  clear() {
    map.clear();
  },
};

export type HudState = {
  hp: number;
  maxHp: number;
  lit: number[];
  wisps: number;
  kills: number;
  zone: number;
  abilities: { dash: boolean; wall: boolean; double: boolean };
  boss: { name: string; hp: number; max: number } | null;
  timer: number; // seconds left, 0 = off
  tablets: number;
};
