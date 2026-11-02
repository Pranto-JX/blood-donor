# রক্তসাথী

রক্তসাথী একটি responsive website এবং installable PWA। Vite frontend, Supabase Auth/PostgreSQL এবং database Row Level Security ব্যবহার করে। Portfolio site-এর ফাইলগুলো আলাদা রাখা হয়েছে।

## Local development

1. Node.js 20.19+ বা 22.12+ install থাকতে হবে।
2. Terminal-এ `cd "D:\Website\4\blood-donor"` চালাও।
3. `npm.cmd install` চালাও।
4. `.env.example` কপি করে `.env.local` বানাও। Supabase project URL ও **publishable/anon key** বসাও।
5. Supabase SQL Editor-এ `supabase/schema.sql`-এর সম্পূর্ণ SQL একবার চালাও।
6. Supabase Authentication URL Configuration-এর redirect allow list-এ `http://localhost:5173`, final HTTPS domain এবং Android callback `com.rokotosathi.app://auth/callback` যোগ করো। Email confirmation link চালু রাখো।
7. `npm.cmd run dev` চালিয়ে দেখানো URL খোলো।

Backend key না থাকলে UI-তে setup নির্দেশনা দেখাবে; fake donor/request দেখাবে না। Supabase `service_role` বা secret key কখনো `.env.local`, browser code, GitHub বা Vercel frontend environment-এ যোগ করবে না। Vite-এর `VITE_` variable browser bundle-এ প্রকাশিত হয়—শুধু Supabase project URL ও publishable/anon key ব্যবহার করো। Database RLS-ই data access সীমাবদ্ধ রাখে।

## Production website ও installable app

একই HTTPS URL-ই website এবং PWA; আলাদা Android app package লাগবে না। সবাই URL খুলে ব্যবহার করবে; সমর্থিত browser-এ install prompt বা browser menu দিয়ে Home Screen-এ যোগ করবে।

1. একটি Supabase project তৈরি করে `supabase/schema.sql` চালাও।
2. Supabase Auth URL Configuration-এ local ও final HTTPS domain এবং `com.rokotosathi.app://auth/callback` redirect URL allow করো। Android app custom deep link দিয়ে email confirmation link গ্রহণ করে।
3. GitHub-এ `blood-donor` folder-এর ভেতরের project files repository root হিসেবে push করো। `.env.local` commit করবে না।
4. Vercel-এ repository import করে Root Directory `./` (default), Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist` দাও।
5. Vercel Project Settings → Environment Variables-এ `VITE_SUPABASE_URL` এবং `VITE_SUPABASE_ANON_KEY` যোগ করে redeploy করো।
6. Vercel domain বা নিজের domain দিয়ে website test করো; HTTPS-এ manifest ও service worker চালু হবে। Supabase Auth redirect allow list-এ final domain-ও যোগ করো।

## Android APK বানানো

Capacitor Android wrapper একই frontend-কে Android app হিসেবে প্যাকেজ করে। APK-তে Supabase সংযোগ কাজ করার জন্য build-এর সময় Supabase project URL ও publishable/anon key দিতে হবে; `service_role`/secret key কখনো নয়।

### নিজের কম্পিউটারে debug APK

1. Android Studio install করে Android SDK Platform 36 ও Build Tools 36.0.0 install করো।
2. JDK 21 install করো এবং `JAVA_HOME` সেট করো।
3. এই project folder-এ `.env.local`-এ Supabase-এর publishable config যোগ করো।
4. `npm.cmd ci` তারপর `npm.cmd run android:sync` চালাও।
5. `cd android` চালিয়ে `.\gradlew.bat assembleDebug` চালাও।
6. APK পাওয়া যাবে `android\app\build\outputs\apk\debug\app-debug.apk`-এ। Android ফোনে APK পাঠিয়ে install করো; প্রয়োজনে Android-এর “Install unknown apps” permission দিতে হবে।

### GitHub Actions-এ APK build

Project files-গুলো GitHub repository-র root-এ রাখো (যে folder-এ `package.json` আছে)। Repository Settings → Secrets and variables → Actions-এ `VITE_SUPABASE_URL` এবং `VITE_SUPABASE_ANON_KEY` secrets যোগ করো। `.env.local`/`service_role` key push করবে না। এরপর Actions → **Build Android APK** → **Run workflow** বেছে নাও; সফল run শেষে `rokto-shathi-debug-apk` artifact download করো। `push`-এ workflow-টিও স্বয়ংক্রিয়ভাবে চলে।

এই workflow debug APK তৈরি করে—ফোনে পরীক্ষা/সরাসরি install করা যাবে। Play Store বা release distribution-এর জন্য নিজের নিরাপদ signing keystore দিয়ে আলাদা signed release build লাগবে; keystore GitHub-এ commit করবে না।

## বাস্তব ব্যবহার ও নিরাপত্তা

- Donor public listing-এ দেখানোর আগে সম্মতি দিতে হয়; ফোন private table-এ থাকে।
- অন্য user phone দেখতে পারে কেবল donor contact request গ্রহণ করলে। Donor profile লুকালে আগের contact-এর phone access-ও বন্ধ হয়।
- Authenticated user-রাই donor profile, blood request বা contact request তৈরি করতে পারে; RLS প্রতিটি row/operation সীমাবদ্ধ করে।
- Public blood request-এ patient name, phone, home address বা medical report field নেই। এমন তথ্য সাধারণ location field-এও লিখবে না।
- UI/DB প্রথম MVP-এর জন্য; বাস্তবে প্রকাশের আগে moderation/abuse report, user/account deletion, rate limits, data-retention/privacy notice, backup, monitoring এবং স্থানীয় স্বাস্থ্য/গোপনীয়তা আইন review দরকার।
- ফোন নম্বর database-এ রাখা হয়; contact request গ্রহণের পরই কেবল donor সম্মতিতে requester দেখতে পারে। Production-এ যাওয়ার আগে এই consent flow বাস্তব ব্যবহারকারীদের দিয়ে পরীক্ষা করো।
- অ্যাপ চিকিৎসা-পরামর্শ বা রক্তের compatibility নির্ধারণ করে না; hospital/blood bank/qualified clinician নিশ্চিত করবেন।

## দরকারি commands

- `npm.cmd run dev` — local development
- `npm.cmd run build` — production bundle তৈরি (`dist/`)
- `npm.cmd run android:sync` — web bundle তৈরি ও Android project sync
- `npm.cmd run android:open` — Android Studio-তে native project খোলা
- `npm.cmd run preview` — production bundle স্থানীয়ভাবে দেখা
