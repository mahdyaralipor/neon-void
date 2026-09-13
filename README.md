# NEON VOID v2 — آرنا سروایور نئونی

بازی Arena Survival کامل با **انجین اختصاصی Canvas 2D**: فیزیک، ۹ هوش مصنوعی دشمن،
الیت‌ها، پاورآپ‌ها، تیغه‌های مداری، سیستم ذرات پول‌شده، صدای سنتزشده، باس،
۲۱ ارتقای روگ‌لایت، کمبو، دش گوستی، مینی‌مپ، ۳ کشتی، گرید S/A/B/C و لیدربورد محلی.

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

## گیم‌پلی v2

- **کشتی‌ها:** ونگارد (متعادل)، فانتوم (سریع/شکننده/کریت)، تایتان (تانک/آرمور).
- **موج‌ها:** سهمیه کیل `6 + wave*4.5`؛ استراحت ۳.۲s + ۱۲٪ درمان؛ بنر + اعلام پاکسازی.
- **۹ دشمن:** Chaser، Weaver، Dasher، Shooter، Splitter، Mini، **Sniper** (تلگراف لیزری + بولت سریع)، **Tank** (زره‌پوش)، **Boss** هر ۵ موج.
- **الیت‌ها (طلایی):** ۳.۲× جان، ۵× تجربه، ۴× امتیاز + دراپ پاورآپ تضمینی.
- **پاورآپ‌ها:** سپر انرژی (۶s)، مگنت همگانی (۸s)، انفجار هسته‌ای، اور‌درایو (۸s دمیج/فایر ×۱.۵–۱.۷)، درمان +۴۰.
- **تیغه مداری:** تا ۳ تیغه چرخان (۶۰٪ دمیج) + ارتقای گداخته.
- **۲۱ ارتقا** در ۳ تیر با وزن‌دهی، سینرژی (تیغه گداخته با مداری) و سقف استک.
- **کمبو:** پنجره قابل ارتقا (۴s پایه)، امتیاز اسکیل‌شونده؛ جلاد (executioner) به زخمی‌ها.
- **گرید پایان:** S/A/B/C/D از ترکیب امتیاز/زمان، موج، کیل و کمبو + تابلوی top-5 محلی.

## معماری

```
src/
  game/
    engine.ts      # لوپ، دوربین، shake/slow-mo/hitstop، اسپاون، کالیشن، رندر + گوست/پالس/مداری
    particles.ts   # پول ذرات/شاک‌ویو/متن/استارفیلد (additive)
    audio.ts       # سنتز WebAudio + ولوم موزیک/افکت + سیکوئنسر synthwave
    upgrades.ts    # ۲۱ ارتقا + roll وزن‌دار + مولتی‌پلایرهای داینامیک
    types.ts       # کشتی‌ها، stats، HudSnapshot (مینی‌مپ/اعلان/پاورآپ)، GameResult (گرید)
    storage.ts     # best + board top-5 + totals + settings
  components/
    GameCanvas.tsx / MainMenu.tsx (ship select + stats + board)
    HUD.tsx + Minimap.tsx / UpgradeModal.tsx / GameOver.tsx (grade)
    PauseMenu.tsx / SettingsModal.tsx (music/sfx sliders)
  App.tsx          # ماشین حالت menu/game و playing/upgrade/paused/gameover
```
