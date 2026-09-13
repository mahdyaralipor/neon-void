# NEON VOID v3 — آرنا سروایور نئونی

بازی Arena Survival کامل با **انجین اختصاصی Canvas 2D**: فیزیک، ۱۱ هوش مصنوعی دشمن،
الیت‌ها با affix، موتاتور موج‌ها، ۶ پاورآپ، تیغه‌های مداری، موشک‌های جوینده، انفجار نووا،
سیستم ذرات پول‌شده، صدای سنتزشده، باس‌های چندمرحله‌ای (tier)، ۲۴ ارتقای روگ‌لایت،
کمبو، دش گوستی، مینی‌مپ زنده، ۴ کشتی، **آزمایشگاه متا (ارتقای دائمی)**،
گرید S/A/B/C، لیدربورد محلی و ۱۲ اچیومنت ماندگار.

> React 19 + TypeScript + Tailwind v4 + Vite + Canvas 2D + WebAudio ·
> بازی زنده: https://mahdyaralipor.github.io/neon-void/

## اجرا

```bash
npm install
npm run dev      # توسعه
npm run build    # بیلد production
npm run preview  # پیش‌نمایش بیلد
```

## کنترل‌ها

| ورودی | عمل |
|---|---|
| `WASD` / جهت‌نما | حرکت |
| موس | aim (شلیک خودکار است) |
| `Shift` / `Space` | دش با فریم ضدضربه + گوست |
| `P` / `Esc` | توقف |
| `1` `2` `3` | انتخاب ارتقا |
| موبایل | جوی‌استیک چپ = حرکت، راست = aim + دکمه دش |

## گیم‌پلی v3

- **کشتی‌ها:** ونگارد (متعادل)، فانتوم (سریع/شکننده/کریت)، تایتان (تانک/آرمور)، **واردن** (شروع با تیغه مداری).
- **آزمایشگاه خلأ:** خرده‌های خلأ (◇) از الیت‌ها و باس‌ها → ۴ مسیر ارتقای دائمی (سلاح/بدنه/موتور/حافظه).
- **موج‌ها:** سهمیه کیل `6 + wave*4.5`؛ استراحت ۳.۲s + ۱۲٪ درمان؛ پورتال اسپاون با هشدار برای همه دشمنان.
- **موتاتورها (هر موج ۳م غیرباس):** هجوم گروهی، لانه اسنایپر، شکار الیت، موج سرعت، **تب طلا** (الیت و جم بیشتر).
- **۱۱ دشمن:** Chaser، Weaver، Dasher، Shooter، Splitter، Mini، Sniper، Tank، **Lancer** (شارژ دوربرد با تلگراف)، **Hive** (زاینده مینی)، **Boss** هر ۵ موج با tier بالاتر (احضار، اسپیرال دوتایی، اعلان فاز).
- **الیت‌ها (طلایی):** ۳.۲× جان، ۵× تجربه + affix + حلقه هشدار برای منفجرشونده‌ها.
- **۶ پاورآپ:** سپر، مگنت، نیوک، اور‌درایو، درمان، **یخبندان** (کند کردن زمان دشمنان).
- **سلاح‌های جدید:** انفجار نووا (دوره‌ای)، موشک جوینده (هدایت‌شونده)، فرصت دوباره (نجات از مرگ).
- **۱۲ اچیومنت ماندگار** + گرید S/A/B/C/D و top-5 محلی.

## سرعت

- اسپрайت‌های glow از پیش پخته‌شده — صفر `shadowBlur` در حلقه داغ
- spatial grid برای کالیشن‌ها، پولینگ گلوله‌ها، freelist ذرات، صفر allocation در هر فریم
- جم‌ها با یک drawImage (بدون save/rotate)، مینی‌مپ prop-driven با DPR
- کیفیت خودکار (FPS → ذرات/DPR پله‌ای) + بج FPS و auto-pause هنگام مخفی شدن تب

## معماری

```
src/
  game/
    engine.ts      # لوپ، دوربین، گرید کالیشن، رندر + پورتال/ایندیکیتور/نووا/سیکر/باس-tier
    sprites.ts     # کش اسپрайت glow + جم (جایگزین shadowBlur)
    particles.ts   # پول ذرات با freelist + شاک‌ویو/متن/استارفیلد
    audio.ts       # سنتز WebAudio + ولوم + سیکوئنسر (nova/frost/secondwind)
    upgrades.ts    # ۲۴ ارتقا + roll وزن‌دار + مولتی‌پلایرهای داینامیک
    achievements.ts# ۱۲ اچیومنت + persist محلی
    types.ts       # کشتی‌ها، موتاتورها، متا، stats، HudSnapshot (mods)، GameResult (shards)
    storage.ts     # best + board + totals + shards + meta + settings
  components/
    GameCanvas.tsx / MainMenu.tsx (ship select + Lab + board + achievements)
    LabModal.tsx / HUD.tsx (mods + frost) + Minimap.tsx / UpgradeModal.tsx
    GameOver.tsx (grade + shards) / PauseMenu.tsx / SettingsModal.tsx
  App.tsx          # ماشین حالت menu/game و playing/upgrade/paused/gameover
```
