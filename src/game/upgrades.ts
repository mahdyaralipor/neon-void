import type { PlayerStats, UpgradeDef } from './types';

export const UPGRADE_POOL: UpgradeDef[] = [
  {
    id: 'damage', nameFa: 'گلوله‌های سنگین', nameEn: 'Heavy Rounds',
    descFa: '+۲۵٪ دمیج', descEn: '+25% damage',
    tier: 'common', maxStacks: 8, icon: 'swords',
  },
  {
    id: 'firerate', nameFa: 'ماشه سریع', nameEn: 'Rapid Trigger',
    descFa: '+۱۸٪ سرعت شلیک', descEn: '+18% fire rate',
    tier: 'common', maxStacks: 8, icon: 'zap',
  },
  {
    id: 'multishot', nameFa: 'شلیک چندگانه', nameEn: 'Split Shot',
    descFa: '+۱ پرتابه (کمی دمیج کمتر)', descEn: '+1 projectile',
    tier: 'epic', maxStacks: 3, icon: 'split',
  },
  {
    id: 'pierce', nameFa: 'گلوله نافذ', nameEn: 'Piercing Core',
    descFa: 'گلوله‌ها +۱ دشمن را سوراخ می‌کنند (+۴٪ دمیج)', descEn: '+1 pierce',
    tier: 'rare', maxStacks: 4, icon: 'arrow',
  },
  {
    id: 'velocity', nameFa: 'شتاب‌دهنده ریلی', nameEn: 'Rail Accelerator',
    descFa: '+۲۰٪ سرعت گلوله +۴٪ دمیج', descEn: '+20% bullet speed',
    tier: 'common', maxStacks: 5, icon: 'wind',
  },
  {
    id: 'crit', nameFa: 'هدف‌گیری حیاتی', nameEn: 'Deadeye',
    descFa: '+۱۲٪ شانس کریت (×۲.۱ دمیج)', descEn: '+12% crit chance',
    tier: 'rare', maxStacks: 5, icon: 'crosshair',
  },
  {
    id: 'speed', nameFa: 'پیشران یونی', nameEn: 'Ion Thrusters',
    descFa: '+۱۲٪ سرعت حرکت +۸٪ مگنت', descEn: '+12% move speed',
    tier: 'common', maxStacks: 6, icon: 'gauge',
  },
  {
    id: 'maxhp', nameFa: 'زره تیتانیومی', nameEn: 'Titan Hull',
    descFa: '+۲۵ جان حداکثر و درمان ۲۵', descEn: '+25 max HP & heal',
    tier: 'common', maxStacks: 8, icon: 'heart',
  },
  {
    id: 'regen', nameFa: 'نانوبات‌های ترمیم', nameEn: 'Nanobots',
    descFa: '+۱.۶ جان در ثانیه +۵ جان', descEn: '+1.6 HP/s regen',
    tier: 'rare', maxStacks: 6, icon: 'pulse',
  },
  {
    id: 'magnet', nameFa: 'آهنربای کوانتومی', nameEn: 'Quantum Magnet',
    descFa: '+۴۵٪ شعاع جذب +۵٪ تجربه', descEn: '+45% pickup radius',
    tier: 'common', maxStacks: 5, icon: 'magnet',
  },
  {
    id: 'armor', nameFa: 'سپر بازتابی', nameEn: 'Aegis Shield',
    descFa: '-۲ دمیج ورودی +۵ جان (حداقل ۱)', descEn: '-2 incoming damage',
    tier: 'rare', maxStacks: 5, icon: 'shield',
  },
  {
    id: 'dash', nameFa: 'دش فاز', nameEn: 'Phase Dash',
    descFa: '-۲۲٪ کول‌داون دش', descEn: '-22% dash cooldown',
    tier: 'rare', maxStacks: 4, icon: 'dash',
  },
  {
    id: 'xp', nameFa: 'پردازنده تجربه', nameEn: 'XP Processor',
    descFa: '+۲۵٪ جم تجربه +۳٪ دمیج', descEn: '+25% XP gain',
    tier: 'common', maxStacks: 5, icon: 'star',
  },
  {
    id: 'lifesteal', nameFa: 'مصرف‌کننده خلأ', nameEn: 'Void Siphon',
    descFa: 'هر کیل +۱.۵ جان', descEn: '+1.5 HP per kill',
    tier: 'epic', maxStacks: 4, icon: 'droplet',
  },
  {
    id: 'overdrive', nameFa: 'اور درایو', nameEn: 'Overdrive',
    descFa: '+۱۲٪ دمیج و +۱۰٪ سرعت شلیک', descEn: '+12% dmg, +10% rate',
    tier: 'epic', maxStacks: 5, icon: 'flame',
  },
  // ---- NEW in v2 ----
  {
    id: 'orbital', nameFa: 'تیغه مداری', nameEn: 'Orbital Blade',
    descFa: '+۱ تیغه چرخان دور کشتی (۶۰٪ دمیج)', descEn: '+1 orbiting blade',
    tier: 'epic', maxStacks: 3, icon: 'orbit',
  },
  {
    id: 'bladeplus', nameFa: 'تیغه گداخته', nameEn: 'Molten Edge',
    descFa: 'تیغه‌ها و گلوله‌ها +۱۵٪ دمیج', descEn: '+15% all damage',
    tier: 'rare', maxStacks: 5, icon: 'axe',
  },
  {
    id: 'executioner', nameFa: 'جلاد', nameEn: 'Executioner',
    descFa: '+۶۰٪ دمیج به دشمنان زیر ۳۰٪ جان', descEn: '+60% dmg to wounded',
    tier: 'rare', maxStacks: 3, icon: 'skull',
  },
  {
    id: 'combomaster', nameFa: 'استاد کمبو', nameEn: 'Combo Master',
    descFa: 'کمبو دیرتر می‌ریزد + امتیاز کمبو ×۲', descEn: 'longer combo, 2x score',
    tier: 'rare', maxStacks: 3, icon: 'combo',
  },
  {
    id: 'emergency', nameFa: 'پروتکل اضطراری', nameEn: 'Emergency Protocol',
    descFa: 'زیر ۳۰٪ جان: +۵۰٪ سرعت و +۴ ریجن', descEn: 'low-HP berserk + regen',
    tier: 'epic', maxStacks: 2, icon: 'siren',
  },
  {
    id: 'thorns', nameFa: 'هاله خار', nameEn: 'Thorn Halo',
    descFa: 'تماس دشمن ۱۲ دمیج به خودش می‌زند', descEn: '+12 contact reflect',
    tier: 'rare', maxStacks: 3, icon: 'thorns',
  },
  // ---- NEW in v3 ----
  {
    id: 'nova', nameFa: 'انفجار نووا', nameEn: 'Nova Burst',
    descFa: 'هر ۸ ثانیه موج انفجاری دور کشتی', descEn: 'radial nova blast',
    tier: 'epic', maxStacks: 3, icon: 'nova',
  },
  {
    id: 'seeker', nameFa: 'موشک جوینده', nameEn: 'Seeker Missile',
    descFa: 'هر ۳ ثانیه موشک هدایت‌شونده', descEn: 'homing missile',
    tier: 'rare', maxStacks: 4, icon: 'seeker',
  },
  {
    id: 'secondwind', nameFa: 'فرصت دوباره', nameEn: 'Second Wind',
    descFa: 'نجات از مرگ با ۳۰٪ جان (۹۰ ثانیه کول‌داون)', descEn: 'cheat death once',
    tier: 'epic', maxStacks: 2, icon: 'secondwind',
  },
  // ---- NEW in v6 ----
  {
    id: 'chain', nameFa: 'طوفان زنجیره‌ای', nameEn: 'Chain Storm',
    descFa: 'هر ۴ ثانیه صاعقه به ۵ دشمن نزدیک', descEn: 'chain lightning zap',
    tier: 'epic', maxStacks: 3, icon: 'chain',
  },
  {
    id: 'headhunter', nameFa: 'شکارچی سر', nameEn: 'Headhunter',
    descFa: '+۴۰٪ دمیج کریت +۴٪ شانس کریت', descEn: '+40% crit damage',
    tier: 'rare', maxStacks: 4, icon: 'headhunter',
  },
  {
    id: 'phasedive', nameFa: 'شیرجه فاز', nameEn: 'Phase Dive',
    descFa: 'دش به دشمنان ۳× دمیج می‌زند', descEn: 'dash deals damage',
    tier: 'rare', maxStacks: 3, icon: 'phasedive',
  },
  // ---- NEW in v7.3 ----
  {
    id: 'sniper', nameFa: 'گلوله تک‌تیرانداز', nameEn: 'Sniper Rounds',
    descFa: '+۳۵٪ دمیج و +۳۰٪ سرعت گلوله، -۱۰٪ سرعت شلیک', descEn: 'heavy slow rounds',
    tier: 'rare', maxStacks: 4, icon: 'sniper',
  },
  {
    id: 'fortress', nameFa: 'دژ متحرک', nameEn: 'Fortress',
    descFa: '+۴۰ جان و +۲ آرمور، -۸٪ سرعت', descEn: 'tank up, slow down',
    tier: 'rare', maxStacks: 4, icon: 'fortress',
  },
  // ---- NEW in v7.5 — HYBRID FUSIONS (synergy upgrades) ----
  {
    id: 'stormrounds', nameFa: 'گلوله‌های طوفانی', nameEn: 'Storm Rounds',
    descFa: 'گلوله‌ها ۲۵٪ شانس صاعقه به ۳ دشمن نزدیک (سینرژی با طوفان زنجیره‌ای)', descEn: 'bullets may chain lightning',
    tier: 'epic', maxStacks: 3, icon: 'storm',
  },
  {
    id: 'critnova', nameFa: 'انفجار کریتیکال', nameEn: 'Crit Detonation',
    descFa: 'کریت‌ها منفجر می‌شوند: دمیج ناحیه‌ای ۹۰٪ (سینرژی با ددآی)', descEn: 'crits explode for AoE',
    tier: 'epic', maxStacks: 3, icon: 'detonate',
  },
  {
    id: 'novadash', nameFa: 'دش نووایی', nameEn: 'Nova Drive',
    descFa: 'هر دش یک انفجار نووا آزاد می‌کند (سینرژی با نووا/فاز)', descEn: 'dash unleashes a nova blast',
    tier: 'epic', maxStacks: 2, icon: 'novadrive',
  },
  {
    id: 'vampire', nameFa: 'مدار خون‌آشام', nameEn: 'Vampiric Orbit',
    descFa: 'تیغه‌های مداری با هر ضربه جان می‌دزدند (سینرژی با لایف‌استیل)', descEn: 'blades steal life on hit',
    tier: 'rare', maxStacks: 3, icon: 'vampire',
  },
  {
    id: 'twinlink', nameFa: 'پیوند دوقلو', nameEn: 'Twin Link',
    descFa: '+۱ موشک جوینده در هر والی و +۶٪ سرعت شلیک (سینرژی با سیکر)', descEn: '+1 seeker per volley',
    tier: 'rare', maxStacks: 3, icon: 'twinlink',
  },
  {
    id: 'phoenix', nameFa: 'هسته ققنوس', nameEn: 'Phoenix Core',
    descFa: 'احیای انفجاری با ۶۰٪ جان + نووای عظیم (سینرژی با فرصت دوباره)', descEn: 'explosive rebirth + mega nova',
    tier: 'epic', maxStacks: 1, icon: 'phoenix',
  },
  {
    id: 'temporal', nameFa: 'کویل زمانی', nameEn: 'Temporal Coil',
    descFa: 'دش زمان دشمنان را ۱ ثانیه کند می‌کند + کول‌داون کمتر', descEn: 'dash slows enemy time',
    tier: 'rare', maxStacks: 3, icon: 'temporal',
  },
  {
    id: 'midas', nameFa: 'موتور میداس', nameEn: 'Midas Engine',
    descFa: 'جم‌ها +۲۵٪ ارزش و کیل‌ها +۱۰٪ امتیاز (سینرژی با کمبو)', descEn: 'richer gems, fatter score',
    tier: 'rare', maxStacks: 4, icon: 'midas',
  },
  {
    id: 'hyperrail', nameFa: 'ریل هایپر', nameEn: 'Hyper Rail',
    descFa: '+۱ نافذ، +۱۵٪ دمیج و +۱۲٪ سرعت گلوله', descEn: 'pierce + damage + velocity',
    tier: 'rare', maxStacks: 3, icon: 'hyperrail',
  },
];

export function applyUpgrade(stats: PlayerStats, id: string): void {
  switch (id) {
    case 'damage': stats.damage *= 1.25; break;
    case 'firerate': stats.fireRate = Math.min(14, stats.fireRate * 1.18); break;
    case 'multishot':
      stats.multishot = Math.min(5, stats.multishot + 1);
      stats.damage *= 0.92;
      break;
    case 'pierce': stats.pierce += 1; stats.damage *= 1.04; break;
    case 'velocity': stats.bulletSpeed *= 1.2; stats.damage *= 1.04; break;
    case 'crit': stats.critChance = Math.min(0.75, stats.critChance + 0.12); break;
    case 'speed': stats.moveSpeed *= 1.12; stats.magnet *= 1.08; break;
    case 'maxhp': stats.maxHp += 25; break;
    case 'regen': stats.regen += 1.6; stats.maxHp += 5; break;
    case 'magnet': stats.magnet *= 1.45; stats.xpGainMult *= 1.05; break;
    case 'armor': stats.armor += 2; stats.maxHp += 5; break;
    case 'dash': stats.dashCooldownMax = Math.max(0.7, stats.dashCooldownMax * 0.78); break;
    case 'xp': stats.xpGainMult *= 1.25; stats.damage *= 1.03; break;
    case 'lifesteal': stats.lifesteal += 1.5; break;
    case 'overdrive':
      stats.damage *= 1.12;
      stats.fireRate = Math.min(14, stats.fireRate * 1.1);
      break;
    case 'orbital':
      stats.orbitals = Math.min(4, stats.orbitals + 1);
      stats.orbitalDamage *= 1.12;
      break;
    case 'bladeplus':
      stats.damage *= 1.15;
      stats.orbitalDamage *= 1.15;
      break;
    case 'executioner': stats.damage *= 1.12; break; // bonus applied dynamically
    case 'combomaster': stats.xpGainMult *= 1.1; break;
    case 'emergency': stats.maxHp += 15; stats.regen += 0.8; break;
    case 'thorns': stats.armor += 1; break;
    case 'chain': stats.fireRate = Math.min(14, stats.fireRate * 1.04); break;
    case 'headhunter': stats.critMult += 0.4; stats.critChance = Math.min(0.8, stats.critChance + 0.04); break;
    case 'phasedive': stats.dashCooldownMax = Math.max(0.6, stats.dashCooldownMax * 0.92); stats.moveSpeed *= 1.03; break;
    case 'sniper': stats.damage *= 1.35; stats.bulletSpeed *= 1.3; stats.fireRate *= 0.9; break;
    case 'fortress': stats.maxHp += 40; stats.armor += 2; stats.moveSpeed *= 0.92; break;
    // ---- v7.5 hybrids ----
    case 'stormrounds': stats.damage *= 1.06; break;
    case 'critnova': stats.critChance = Math.min(0.8, stats.critChance + 0.03); break;
    case 'novadash': stats.dashCooldownMax = Math.max(0.6, stats.dashCooldownMax * 0.94); break;
    case 'vampire':
      stats.orbitalDamage *= 1.1;
      if (stats.orbitals === 0) stats.orbitals = 1;
      break;
    case 'twinlink': stats.fireRate = Math.min(14, stats.fireRate * 1.06); break;
    case 'phoenix': stats.maxHp += 20; break;
    case 'temporal':
      stats.dashCooldownMax = Math.max(0.55, stats.dashCooldownMax * 0.95);
      stats.moveSpeed *= 1.02;
      break;
    case 'midas': stats.xpGainMult *= 1.06; break;
    case 'hyperrail':
      stats.pierce = Math.min(6, stats.pierce + 1);
      stats.damage *= 1.15;
      stats.bulletSpeed *= 1.12;
      break;
  }
}

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADE_POOL.map((u) => [u.id, u]),
);

/** hybrids appear more often when their partner upgrade is owned — builds feel smart */
function synergyBoost(id: string, taken: Map<string, number>): number {
  const has = (k: string) => (taken.get(k) ?? 0) > 0;
  switch (id) {
    case 'stormrounds': return has('chain') || has('velocity') ? 2.2 : 1;
    case 'critnova': return has('crit') || has('headhunter') ? 2.2 : 1;
    case 'novadash': return has('nova') || has('dash') || has('phasedive') ? 2.2 : 1;
    case 'vampire': return has('orbital') || has('lifesteal') ? 2.2 : 1;
    case 'twinlink': return has('seeker') || has('multishot') ? 2.2 : 1;
    case 'phoenix': return has('secondwind') || has('nova') ? 2.5 : 1;
    case 'temporal': return has('dash') || has('phasedive') ? 2 : 1;
    case 'midas': return has('combomaster') || has('xp') || has('magnet') ? 2 : 1;
    case 'hyperrail': return has('pierce') || has('velocity') || has('sniper') ? 2 : 1;
    default: return 1;
  }
}

/** dynamic executioner multiplier — read from taken stacks */
export function executionerMult(taken: Map<string, number>): number {
  const n = taken.get('executioner') ?? 0;
  return 1 + n * 0.6;
}

export function comboScoreMult(taken: Map<string, number>): number {
  const n = taken.get('combomaster') ?? 0;
  return 1 + n; // 2x at 1 stack for combo portion
}

export function comboWindow(taken: Map<string, number>): number {
  const n = taken.get('combomaster') ?? 0;
  return 4 + n * 1.5;
}

export function thornsDamage(taken: Map<string, number>): number {
  return (taken.get('thorns') ?? 0) * 12;
}

/** v7.5 hybrid helpers — single source of truth for engine + UI */
export function stormProcChance(taken: Map<string, number>): number {
  return Math.min(0.75, (taken.get('stormrounds') ?? 0) * 0.25);
}
export function stormTargets(taken: Map<string, number>): number {
  const base = 2 + (taken.get('stormrounds') ?? 0);
  return base + ((taken.get('chain') ?? 0) > 0 ? 2 : 0);
}
export function critNovaMult(taken: Map<string, number>): number {
  return (taken.get('critnova') ?? 0) * 0.9;
}
export function critNovaRadius(taken: Map<string, number>): number {
  return 110 + (taken.get('critnova') ?? 0) * 25;
}
export function midasGemMult(taken: Map<string, number>): number {
  return 1 + (taken.get('midas') ?? 0) * 0.25;
}
export function midasScoreMult(taken: Map<string, number>): number {
  return 1 + (taken.get('midas') ?? 0) * 0.1;
}

export function rollUpgrades(taken: Map<string, number>, count = 3): UpgradeDef[] {
  const avail = UPGRADE_POOL.filter((u) => (taken.get(u.id) ?? 0) < u.maxStacks);
  // orbitals need no prerequisite; bladeplus slightly more likely if orbitals owned
  const picks: UpgradeDef[] = [];
  const bag = [...avail];
  const weight = (t: string) => (t === 'epic' ? 1.2 : t === 'rare' ? 2.4 : 4);
  while (picks.length < Math.min(count, bag.length)) {
    let total = 0;
    for (const u of bag) {
      let w = weight(u.tier);
      if (u.id === 'bladeplus' && (taken.get('orbital') ?? 0) > 0) w *= 2;
      w *= synergyBoost(u.id, taken);
      total += w;
    }
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < bag.length; i++) {
      let w = weight(bag[i].tier);
      if (bag[i].id === 'bladeplus' && (taken.get('orbital') ?? 0) > 0) w *= 2;
      w *= synergyBoost(bag[i].id, taken);
      r -= w;
      if (r <= 0) { idx = i; break; }
    }
    picks.push(bag[idx]);
    bag.splice(idx, 1);
  }
  return picks;
}
