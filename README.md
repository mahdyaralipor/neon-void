# NEON VOID v2.1 — آرنا سروایور نئونی

بازی Arena Survival کامل با **انجین اختصاصی Canvas 2D**: فیزیک، ۹ هوش مصنوعی دشمن،
الیت‌ها با affix، موتاتور موج‌ها، پاورآپ‌ها، تیغه‌های مداری، سیستم ذرات پول‌شده،
صدای سنتزشده، باس با پتن اسپیرال، ۲۱ ارتقای روگ‌لایت، کمبو، دش گوستی، مینی‌مپ،
۳ کشتی، گرید S/A/B/C، لیدربورد محلی و ۹ اچیومنت ماندگار.

> React 19 + TypeScript + Tailwind v4 + Vite + Canvas 2D + WebAudio

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

## گیم‌پلی v2.1

- **کشتی‌ها:** ونگارد (متعادل)، فانتوم (سریع/شکننده/کریت)، تایتان (تانک/آرمور).
- **موج‌ها:** سهمیه کیل `6 + wave*4.5`؛ استراحت ۳.۲s + ۱۲٪ درمان؛ بنر + اعلام پاکسازی.
- **موتاتورها (هر موج ۳م غیرباس):** هجوم گروهی (×۱.۵ امتیاز)، لانه اسنایپر، شکار الیت، موج سرعت.
- **۹ دشمن:** Chaser، Weaver، Dasher، Shooter، Splitter، Mini، **Sniper** (تلگراف لیزری + بولت سریع)، **Tank** (زره‌پوش)، **Boss** هر ۵ موج (پتن اسپیرال زیر ۵۵٪ جان).
- **الیت‌ها (طلایی):** ۳.۲× جان، ۵× تجربه، ۴× امتیاز + دراپ پاورآپ تضمینی + affix (منفجرشونده/سریع).
- **پاورآپ‌ها:** سپر انرژی (۶s)، مگنت همگانی (۸s)، انفجار هسته‌ای، اور‌درایو (۸s دمیج/فایر ×۱.۵–۱.۷)، درمان +۴۰.
- **تیغه مداری:** تا ۳ تیغه چرخان (۶۰٪ دمیج) + ارتقای گداخته.
- **۲۱ ارتقا** در ۳ تیر با وزن‌دهی، سینرژی (تیغه گداخته با مداری) و سقف استک.
- **کمبو:** پنجره قابل ارتقا (۴s پایه)، امتیاز اسکیل‌شونده؛ جلاد (executioner) به زخمی‌ها.
- **۹ اچیومنت ماندگار** (اولین خون، کمبو ۵۰، باس بی‌نقص، نیوک ۲۰تایی...) + گرید S/A/B/C/D و top-5 محلی.

## سرعت (v2.1)

- اسپрайت‌های glow از پیش پخته‌شده — صفر `shadowBlur` در حلقه داغ
- spatial grid برای کالیشن گلوله/مداری/تماس، پولینگ گلوله‌ها، حذف allocation هر فریم
- گرادیان‌های کش‌شده، کیفیت خودکار (FPS → ذرات/DPR پله‌ای) + بج FPS و auto-pause هنگام مخفی شدن تب

## معماری

```
src/
  game/
    engine.ts      # لوپ، دوربین، shake/slow-mo/hitstop، گرید کالیشن، رندر + گوست/پالس/مداری/اسپیرال
    sprites.ts     # کش اسپрайت glow (جایگزین shadowBlur)
    particles.ts   # پول ذرات/شاک‌ویو/متن/استارفیلد (additive)
    audio.ts       # سنتز WebAudio + ولوم موزیک/افکت + سیکوئنسر synthwave
    upgrades.ts    # ۲۱ ارتقا + roll وزن‌دار + مولتی‌پلایرهای داینامیک
    achievements.ts# ۹ اچیومنت + persist محلی
    types.ts       # کشتی‌ها، موتاتورها، stats، HudSnapshot (fps/quality/mutator)، GameResult (گرید)
    storage.ts     # best + board top-5 + totals + settings (autoQuality/showFps)
  components/
    GameCanvas.tsx / MainMenu.tsx (ship select + stats + board + achievements)
    HUD.tsx + Minimap.tsx / UpgradeModal.tsx / GameOver.tsx (grade)
    PauseMenu.tsx / SettingsModal.tsx (music/sfx + auto-quality + fps)
  App.tsx          # ماشین حالت menu/game و playing/upgrade/paused/gameover
```
