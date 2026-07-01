# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPMove is a React Native (Expo) app showing real-time status of São Paulo's public transit network: Metrô, CPTM, and municipal buses (SPTrans). Users track line status, get incident alerts, browse history, view a live bus map, and submit crowdsourced reports. Targets Android, iOS, and web (PWA).

This repo is the frontend only. It's paired with a separate backend repo (`spmove-backend`: Node/Express + Drizzle/SQLite) that aggregates official transit data and serves push notifications. There is no user-account system — identity is an anonymous per-device UUID (`services/deviceId.ts`).

## Commands

```bash
npm start              # expo start (dev server, choose platform from CLI)
npm run android        # expo run:android
npm run ios            # expo run:ios
npm run web             # expo start --web

npm run lint            # eslint .
npm run lint:fix
npm run format           # prettier --write .
npm run typecheck        # tsc --noEmit

npm test                 # jest (all tests)
npm run test:watch
npx jest __tests__/gtfs.test.ts        # single test file
npx jest -t "test name substring"       # single test by name

npm run process-gtfs     # regenerate assets/gtfs-shapes.json + gtfs-stops.json from GTFS source data
```

Tests live in `__tests__/` and run via `jest-expo`. Pre-commit (husky + lint-staged) auto-runs eslint --fix, prettier, and related jest tests on staged `.ts/.tsx` files — don't bypass with `--no-verify`.

## Architecture

### Two independent transit data sources

The app talks to two unrelated backends, and this split is the most important thing to know before touching data code:

- **`services/api.ts`** — the custom backend (`EXPO_PUBLIC_BACKEND_URL`, optional `x-api-key: EXPO_PUBLIC_BACKEND_KEY`). Covers Metrô/CPTM line status (`/api/metro/status/`), incidents (`/api/metro/ocorrencias/`), crowdsourced reports (`services/reports.ts`), server-side GTFS lookups (`services/gtfs.ts`), and push registration (`services/pushRegistration*.ts`).
- **`services/sptrans.ts`** — the official SPTrans "Olho Vivo" API (`https://api.olhovivo.sptrans.com.br/v2.1`, token `EXPO_PUBLIC_SPTRANS_TOKEN`), called directly from the client. Covers bus line search, stops, live vehicle positions, and arrival predictions. Also queries SPTrans' GeoServer directly for route polylines. Manages its own session-cookie workaround for Android's OkHttp stripping cookies.

Metro/CPTM status and bus tracking are separate pipelines even though they render together (e.g. `app/(tabs)/onibus.tsx` overlays GTFS-cached metro data on top of live SPTrans bus data).

### GTFS data: bundled vs. live

`scripts/process-gtfs.js` and `scripts/process-gtfs-stops.js` are offline/build-time scripts that download SPTrans' GTFS feed and pre-process it into `assets/gtfs-shapes.json` (route polylines, keyed by normalized route code like `702C10`) and `assets/gtfs-stops.json` (ordered per-direction stop lists). These ship bundled with the app and are read synchronously via `services/gtfs.ts`. Proximity queries (`getStopsNear`) and enriched metro station/line metadata instead hit the backend live rather than the bundle. Re-run the scripts (and commit the regenerated JSON) when SPTrans' published GTFS changes.

### Theming: mid-migration

`context/RuntimeThemeContext.tsx` + `constants/appThemes.ts` + `constants/themePrefs.ts` implement a runtime-selectable theme system (5 named themes, including "dinamico" which derives its accent color from live line status; selection persisted to AsyncStorage). This replaces the old single hardcoded theme in `constants/theme.ts`. The migration is **partial** — some components still import the static `theme` object directly instead of calling `useRuntimeTheme()`. When touching a screen/component's styling, prefer wiring it to `useRuntimeTheme()` over reintroducing the static import.

### Platform-specific modules

Files with a `.web.tsx`/`.web.ts` sibling (`AdBanner`, `BusMap`, `notifications`, `pushRegistration`, `installPrompt`, `usePWAInstall`) rely on Metro's platform extension resolution — the `.web` variant is a deliberately different implementation, not a stub to keep in sync line-by-line (e.g. `BusMap.web.tsx` renders a "not available on web" placeholder instead of MapLibre; `AdBanner.web.tsx` is a no-op since there's no AdMob on web). Keep prop interfaces identical between a file and its `.web` counterpart so screens can import either transparently.

### Push notifications: two delivery paths

Native uses `expo-notifications` + Expo push tokens (`services/notifications.ts`, `services/pushRegistration.ts`); web uses a service worker (`public/sw.js`) + the Push API with a VAPID key (`services/notifications.web.ts`, `services/pushRegistration.web.ts`). Both register/unregister the device's favorite-line list with the backend (`/api/register` vs `/api/web-push/subscribe`). Per-line and global toggles persist locally via `constants/notifPrefs.ts`.

### Android home-screen widget

`plugins/withAndroidWidget.js` is an Expo config plugin that injects a native Kotlin `AppWidgetProvider` + bridge module (`WidgetModule`) at prebuild time. `services/widgetSync.ts` pushes current favorite-line statuses to it via `NativeModules.WidgetModule`. Because this touches native Android code, changes here require `expo prebuild` (already wired into `postinstall`) and a native rebuild, not just a JS reload.

### State management

No Redux/Zustand/Jotai/MobX. Server state is React Query (`QueryClientProvider` in `app/_layout.tsx`: 2 retries, 5 min stale time, 10 min cache time); cross-cutting client state is plain React Context (`RuntimeThemeContext`, `SubscriptionContext`). Everything else is local `useState`.

### Subscription / premium

`context/SubscriptionContext.tsx` currently hardcodes `isPremium = true` (`purchase()`/`restore()` are no-op stubs) — in-app purchases aren't implemented yet. This is intentional, not a bug: ad-gating and premium UI are built ahead of the IAP integration.

### Routing

Uses `expo-router` (file-based, typed routes enabled). `app/_layout.tsx` owns the provider stack (gesture handler → safe area → React Query → theme → subscription → bottom sheet) and the onboarding redirect (an AsyncStorage key from `constants/storage.ts` gates `/onboarding` vs `/(tabs)`). `/settings` and `/subscription` are presented as modals; `/line/[id]` is a pushed stack screen reachable from every tab.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): every push/PR runs typecheck + lint + jest. On `main`/`master`, a `release` job runs `semantic-release` (Conventional Commits drive version bumps — `feat`→minor, `fix`/`refactor`→patch, breaking→major; updates `CHANGELOG.md` and `app.json`). A `deploy` job then builds an Android preview APK (attached to the GitHub release) and a production AAB submitted to the Play Store internal track, both via EAS. Web deploys to Vercel (`vercel.json`) via `expo export --platform web`. `.github/workflows/deploy.yml` is a manual, one-off Play Store submission workflow with a selectable track.

Commit messages are enforced by commitlint + husky (Conventional Commits, lowercase subject, ≤100 chars).

## Conventions

- `no-console` is an ESLint error — don't leave `console.log` in.
- `@typescript-eslint/no-explicit-any` is a warning — avoid `any`.
- Path alias `@/*` maps to the project root (see `tsconfig.json`).

## Environment variables

Required in `.env.local` (never commit real values):

- `EXPO_PUBLIC_BACKEND_URL` — custom backend base URL
- `EXPO_PUBLIC_BACKEND_KEY` — optional backend API key header
- `EXPO_PUBLIC_SPTRANS_TOKEN` — SPTrans Olho Vivo API token
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` — web push VAPID public key
