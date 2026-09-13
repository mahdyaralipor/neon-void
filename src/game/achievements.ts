/* Persistent achievements — unlocked in-run, stored in localStorage. */

export interface AchievementDef {
  id: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  icon: string; // lucide icon key
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', nameFa: 'اولین خون', nameEn: 'FIRST BLOOD', descFa: 'اولین کیل ران', icon: 'droplet' },
  { id: 'combo50', nameFa: 'کمبو ×۵۰', nameEn: 'COMBO x50', descFa: 'کمبوی ۵۰تایی', icon: 'combo' },
  { id: 'elite5', nameFa: 'شکارچی الیت', nameEn: 'ELITE HUNTER', descFa: '۵ الیت در یک ران', icon: 'crown' },
  { id: 'boss1', nameFa: 'باس‌کش', nameEn: 'BOSS SLAYER', descFa: 'شکست دادن یک باس', icon: 'skull' },
  { id: 'flawless_boss', nameFa: 'بی‌نقص', nameEn: 'FLAWLESS', descFa: 'باس بدون حتی یک دمیج', icon: 'shield' },
  { id: 'wave10', nameFa: 'جان‌سخت', nameEn: 'SURVIVOR', descFa: 'رسیدن به موج ۱۰', icon: 'medal' },
  { id: 'nuke20', nameFa: 'هسته‌ای', nameEn: 'NUKEM', descFa: 'یک نیوک با ۲۰+ کیل', icon: 'nuke' },
  { id: 'orbital3', nameFa: 'ارباب تیغه', nameEn: 'BLADE LORD', descFa: '۳ تیغه مداری همزمان', icon: 'orbit' },
  { id: 'survivor5', nameFa: '۵ دقیقه جهنم', nameEn: '5 MINUTES', descFa: '۵ دقیقه بقا در یک ران', icon: 'timer' },
  { id: 'hive_cleanser', nameFa: 'کندوکُش', nameEn: 'HIVE CLEANSER', descFa: 'نابودی ۳ کندو در یک ران', icon: 'hexagon' },
  { id: 'frost_king', nameFa: 'سلطان یخ', nameEn: 'FROST KING', descFa: 'منجمد کردن ۲۵+ دشمن همزمان', icon: 'snowflake' },
  { id: 'second_wind', nameFa: 'فرصت دوباره', nameEn: 'SECOND WIND', descFa: 'نجات از مرگ حتمی', icon: 'heartpulse' },
];

const KEY = 'neon-void-achievements-v1';

export function getUnlockedAchievements(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Returns true if this call newly unlocked the achievement. */
export function unlockAchievement(id: string): boolean {
  try {
    const set = getUnlockedAchievements();
    if (set.has(id)) return false;
    set.add(id);
    localStorage.setItem(KEY, JSON.stringify([...set]));
    return true;
  } catch {
    return false;
  }
}

export function achievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
