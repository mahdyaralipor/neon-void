export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';

export type ShipId = 'vanguard' | 'phantom' | 'titan' | 'warden';

export interface ShipDef {
  id: ShipId;
  nameFa: string;
  nameEn: string;
  descFa: string;
  color: string;
  // multipliers applied on top of BASE_STATS
  damage: number;
  fireRate: number;
  moveSpeed: number;
  maxHp: number;
  magnet: number;
  dashCd: number;
}

export const SHIPS: ShipDef[] = [
  {
    id: 'vanguard', nameFa: 'ونگارد', nameEn: 'VANGUARD',
    descFa: 'متعادل و مطمئن — انتخاب استاندارد نبرد',
    color: '#00f0ff', damage: 1, fireRate: 1, moveSpeed: 1, maxHp: 1, magnet: 1, dashCd: 1,
  },
  {
    id: 'phantom', nameFa: 'فانتوم', nameEn: 'PHANTOM',
    descFa: 'سریع و شکننده — +۱۸٪ سرعت و فایر، −۳۰٪ جان',
    color: '#b14bff', damage: 0.95, fireRate: 1.18, moveSpeed: 1.18, maxHp: 0.7, magnet: 1.2, dashCd: 0.8,
  },
  {
    id: 'titan', nameFa: 'تایتان', nameEn: 'TITAN',
    descFa: 'زره‌پوش سنگین — +۸۰٪ جان و +۳ آرمور، کندتر',
    color: '#ffb020', damage: 1.12, fireRate: 0.92, moveSpeed: 0.9, maxHp: 1.8, magnet: 0.9, dashCd: 1.15,
  },
  {
    id: 'warden', nameFa: 'واردن', nameEn: 'WARDEN',
    descFa: 'نگهبان مداری — شروع با ۱ تیغه + ۱ آرمور، فایر کمتر',
    color: '#3dff8e', damage: 1, fireRate: 0.92, moveSpeed: 0.97, maxHp: 1.2, magnet: 1, dashCd: 1,
  },
];

export type EnemyKind =
  | 'chaser'
  | 'weaver'
  | 'dasher'
  | 'shooter'
  | 'splitter'
  | 'mini'
  | 'sniper'
  | 'tank'
  | 'lancer'
  | 'hive'
  | 'boss';

export type PowerUpKind = 'shield' | 'magnet' | 'nuke' | 'overdrive' | 'heal' | 'frost';

export type MutatorKind = 'swarm' | 'snipers' | 'elite_hunt' | 'surge' | 'gold_rush';

export interface MutatorDef {
  kind: MutatorKind;
  nameFa: string;
  nameEn: string;
  scoreMult: number;
}

export const MUTATORS: Record<MutatorKind, MutatorDef> = {
  swarm: { kind: 'swarm', nameFa: 'هجوم گروهی', nameEn: 'SWARM', scoreMult: 1.5 },
  snipers: { kind: 'snipers', nameFa: 'لانه اسنایپر', nameEn: 'SNIPER NEST', scoreMult: 1.3 },
  elite_hunt: { kind: 'elite_hunt', nameFa: 'شکار الیت', nameEn: 'ELITE HUNT', scoreMult: 1.4 },
  surge: { kind: 'surge', nameFa: 'موج سرعت', nameEn: 'SPEED SURGE', scoreMult: 1.3 },
  gold_rush: { kind: 'gold_rush', nameFa: 'تب طلا', nameEn: 'GOLD RUSH', scoreMult: 1.3 },
};

/** Permanent meta progression (Void Lab) — each track 0..META_MAX_LEVEL. */
export interface MetaLevels {
  dmg: number;
  hp: number;
  speed: number;
  xp: number;
}

export const META_ZERO: MetaLevels = { dmg: 0, hp: 0, speed: 0, xp: 0 };
export const META_MAX_LEVEL = 10;
export function metaCost(level: number): number {
  return 5 * (level + 1);
}

export interface MetaTrackDef {
  id: keyof MetaLevels;
  nameFa: string;
  nameEn: string;
  descFa: string;
  icon: string;
}

export const META_TRACKS: MetaTrackDef[] = [
  { id: 'dmg', nameFa: 'تقویت سلاح', nameEn: 'WEAPON CORE', descFa: 'هر لول +۲٪ دمیج دائمی', icon: 'swords' },
  { id: 'hp', nameFa: 'بدنه تقویت‌شده', nameEn: 'HULL PLATING', descFa: 'هر لول +۲٪ جان دائمی', icon: 'heart' },
  { id: 'speed', nameFa: 'موتور یونی', nameEn: 'ION DRIVE', descFa: 'هر لول +۱٪ سرعت دائمی', icon: 'gauge' },
  { id: 'xp', nameFa: 'حافظه نانویی', nameEn: 'NANO MEMORY', descFa: 'هر لول +۳٪ تجربه دائمی', icon: 'star' },
];

export interface PlayerStats {
  damage: number;
  fireRate: number; // shots per second
  bulletSpeed: number;
  pierce: number;
  multishot: number;
  spread: number; // radians between side bullets
  critChance: number; // 0..1
  critMult: number;
  moveSpeed: number; // px/s
  maxHp: number;
  regen: number; // hp/s
  magnet: number; // px radius
  armor: number; // flat reduction
  dashCooldownMax: number; // s
  xpGainMult: number;
  lifesteal: number; // hp per kill
  orbitals: number; // orbiting blades
  orbitalDamage: number; // multiplier of damage
}

export const BASE_STATS: PlayerStats = {
  damage: 14,
  fireRate: 4.2,
  bulletSpeed: 780,
  pierce: 0,
  multishot: 1,
  spread: 0.11,
  critChance: 0.08,
  critMult: 2.1,
  moveSpeed: 360,
  maxHp: 100,
  regen: 1.1,
  magnet: 125,
  armor: 0,
  dashCooldownMax: 2.0,
  xpGainMult: 1,
  lifesteal: 0,
  orbitals: 0,
  orbitalDamage: 0.6,
};

export function statsForShip(ship: ShipId, meta: MetaLevels = META_ZERO): PlayerStats {
  const s = { ...BASE_STATS };
  const def = SHIPS.find((x) => x.id === ship) ?? SHIPS[0];
  s.damage *= def.damage;
  s.fireRate *= def.fireRate;
  s.moveSpeed *= def.moveSpeed;
  s.maxHp = Math.round(s.maxHp * def.maxHp);
  s.magnet *= def.magnet;
  s.dashCooldownMax *= def.dashCd;
  if (ship === 'titan') s.armor += 3;
  if (ship === 'phantom') s.critChance += 0.06;
  if (ship === 'warden') {
    s.orbitals = 1;
    s.armor += 1;
  }
  // permanent meta bonuses (Void Lab)
  s.damage *= 1 + 0.02 * meta.dmg;
  s.maxHp = Math.round(s.maxHp * (1 + 0.02 * meta.hp));
  s.moveSpeed *= 1 + 0.01 * meta.speed;
  s.xpGainMult *= 1 + 0.03 * meta.xp;
  return s;
}

export type UpgradeTier = 'common' | 'rare' | 'epic';

export interface UpgradeDef {
  id: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  tier: UpgradeTier;
  maxStacks: number;
  icon: string; // lucide icon key used by UI
}

export interface EngineOptions {
  difficulty: Difficulty;
  particleScale: number; // 0..1 (base; auto-quality may scale down at runtime)
  shakeEnabled: boolean;
  muted: boolean;
  ship: ShipId;
  autoQuality: boolean;
  meta: MetaLevels;
  /** global game-speed multiplier (0.9 calm / 1 standard / 1.25 turbo) */
  speed: number;
  /** show floating damage numbers (off = only crits/big hits) */
  showDamageNumbers?: boolean;
}

export interface MinimapDot {
  x: number;
  y: number;
  kind: EnemyKind | 'gem' | 'powerup' | 'player';
  elite?: boolean;
}

export interface PowerUpState {
  kind: PowerUpKind;
  t: number; // remaining seconds
}

export interface WeaponMods {
  nova: number;
  seeker: number;
  secondwind: boolean;
  swCd: number; // second-wind cooldown remaining
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  wave: number;
  kills: number;
  elites: number;
  score: number;
  time: number;
  combo: number;
  comboT: number; // 0..1 remaining
  dashCd: number; // seconds remaining
  dashMax: number;
  bossHp: number | null;
  bossMax: number | null;
  px: number;
  py: number;
  damage: number;
  fireRate: number;
  moveSpeed: number;
  critChance: number;
  critMult: number;
  multishot: number;
  intermission: number; // >0 means break between waves
  waveProgress: number; // 0..1
  waveLeft: number; // kills remaining to clear the wave
  announce: string | null;
  powerups: PowerUpState[];
  orbitals: number;
  mods: WeaponMods;
  dots: MinimapDot[];
  fps: number;
  quality: number; // 0 high, 1 medium, 2 low (auto-quality level)
  mutator: MutatorKind | null;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface GameResult {
  score: number;
  kills: number;
  elites: number;
  wave: number;
  level: number;
  time: number;
  maxCombo: number;
  grade: Grade;
  isBest: boolean;
  upgradesTaken: string[];
  ship: ShipId;
  shards: number;
  powerups: number;
  victory: boolean;
  deathBy: string | null;
}

export interface EngineCallbacks {
  onHud: (h: HudSnapshot) => void;
  onLevelUp: (choices: UpgradeDef[]) => void;
  onGameOver: (r: GameResult) => void;
  onWave: (wave: number) => void;
  onPauseKey: () => void;
}
