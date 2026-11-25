export type Save = {
  v: 1;
  abilities: { dash: boolean; wall: boolean; double: boolean };
  lit: number[];
  wisps: string[];
  tablets: string[];
  kills: number;
  bosses: string[];
  bench: string;
  easy: boolean;
  started: boolean;
  muted: boolean;
};

const KEY = "lantern-below-save-v1";

export const freshSave = (): Save => ({
  v: 1,
  abilities: { dash: false, wall: false, double: false },
  lit: [],
  wisps: [],
  tablets: [],
  kills: 0,
  bosses: [],
  bench: "b0",
  easy: false,
  started: false,
  muted: false,
});

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const s = JSON.parse(raw) as Save;
    if (s.v !== 1) return freshSave();
    return { ...freshSave(), ...s };
  } catch {
    return freshSave();
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. — the game still works, it just won't remember */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
