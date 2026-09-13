import type { Difficulty, MetaLevels, ShipId } from './types';
import { META_ZERO, META_MAX_LEVEL } from './types';

const BEST_KEY = 'neon-void-best';
const BOARD_KEY = 'neon-void-board-v2';
const TOTALS_KEY = 'neon-void-totals-v2';
const SETTINGS_KEY = 'neon-void-settings';
const SHARDS_KEY = 'neon-void-shards-v1';
const META_KEY = 'neon-void-meta-v1';

export interface BoardEntry {
  score: number;
  wave: number;
  kills: number;
  time: number;
  ship: ShipId;
  date: number;
}

export interface Totals {
  runs: number;
  kills: number;
  time: number;
  bestWave: number;
}

export function getBest(): number {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): boolean {
  try {
    const prev = getBest();
    if (score > prev) {
      localStorage.setItem(BEST_KEY, String(Math.floor(score)));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getBoard(): BoardEntry[] {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BoardEntry[];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function pushBoard(e: BoardEntry): BoardEntry[] {
  try {
    const arr = getBoard();
    arr.push(e);
    arr.sort((a, b) => b.score - a.score);
    const top = arr.slice(0, 5);
    localStorage.setItem(BOARD_KEY, JSON.stringify(top));
    return top;
  } catch {
    return [];
  }
}

export function getTotals(): Totals {
  const fb: Totals = { runs: 0, kills: 0, time: 0, bestWave: 0 };
  try {
    const raw = localStorage.getItem(TOTALS_KEY);
    if (!raw) return fb;
    return { ...fb, ...(JSON.parse(raw) as Partial<Totals>) };
  } catch {
    return fb;
  }
}

export function addTotals(kills: number, time: number, wave: number): Totals {
  const t = getTotals();
  t.runs += 1;
  t.kills += kills;
  t.time += time;
  t.bestWave = Math.max(t.bestWave, wave);
  try {
    localStorage.setItem(TOTALS_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
  return t;
}

export interface SavedSettings {
  difficulty: Difficulty;
  particles: number;
  shake: boolean;
  muted: boolean;
  ship: ShipId;
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
  autoQuality: boolean;
  showFps: boolean;
  gameSpeed: number; // 0.9 calm | 1 standard | 1.25 turbo
}

export function getSettings(): SavedSettings {
  const fallback: SavedSettings = {
    difficulty: 'normal',
    particles: 1,
    shake: true,
    muted: false,
    ship: 'vanguard',
    musicVol: 0.8,
    sfxVol: 1,
    autoQuality: true,
    showFps: false,
    gameSpeed: 1,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<SavedSettings>;
    const s = { ...fallback, ...p };
    if (s.gameSpeed !== 0.9 && s.gameSpeed !== 1 && s.gameSpeed !== 1.25) {
      s.gameSpeed = 1;
    }
    return s;
  } catch {
    return fallback;
  }
}

export function saveSettings(s: SavedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---------- Void Lab: shards currency + permanent meta tracks ----------

export function getShards(): number {
  try {
    const v = localStorage.getItem(SHARDS_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

/** Add (or spend, if negative) shards. Returns the new balance. */
export function addShards(n: number): number {
  const next = Math.max(0, getShards() + Math.floor(n));
  try {
    localStorage.setItem(SHARDS_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getMeta(): MetaLevels {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...META_ZERO };
    const p = JSON.parse(raw) as Partial<MetaLevels>;
    const m: MetaLevels = { ...META_ZERO, ...p };
    // sanitize
    (Object.keys(m) as (keyof MetaLevels)[]).forEach((k) => {
      m[k] = Math.max(0, Math.min(META_MAX_LEVEL, Math.floor(m[k]) || 0));
    });
    return m;
  } catch {
    return { ...META_ZERO };
  }
}

/** Buy one level of a meta track. Returns updated {meta, shards} or null if not affordable/maxed. */
export function buyMeta(track: keyof MetaLevels): { meta: MetaLevels; shards: number } | null {
  const meta = getMeta();
  if (meta[track] >= META_MAX_LEVEL) return null;
  const cost = 5 * (meta[track] + 1);
  if (getShards() < cost) return null;
  meta[track] += 1;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  return { meta, shards: addShards(-cost) };
}
