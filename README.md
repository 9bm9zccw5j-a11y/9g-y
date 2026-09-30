# Водяной — магазин сантехники

React 19 + Vite 7 + Tailwind 4 + Supabase + framer-motion.

Весь код приложения — `src/App.tsx`, `src/components/`, `src/hooks/`, `src/utils/`, `src/data/`,
`src/index.css` — без изменений. Данные (товары, категории, заказы, карты, мастера, медиатека)
по-прежнему хранятся в вашем Supabase (`src/utils/supabase.ts`), локальная база не нужна.

Дополнительно в проект добавлена тонкая обёртка **Next.js** (`src/app/`, 3 файла) — она нужна
только для того, чтобы проект запускался в среде разработки платформы, которая собирает Next.js.
Приложение в обоих вариантах одно и то же.

## Запуск (обязательно через сервер, не двойным щелчком)

```bash
npm install          # один раз

npm run dev:vite     # как раньше: Vite, http://localhost:5173
npm run dev          # через Next.js, http://localhost:3000 (так работает превью платформы)
```

Файлы `start.command` (macOS) и `start.bat` (Windows) запускают Vite-вариант двойным щелчком.

**Открывать нужно адрес из терминала**, а не файл `index.html`.
Если открыть `index.html` двойным щелчком — страница будет пустой: браузер не умеет
исполнять `/src/main.tsx` без сборщика.

## Сборка одного файла

```bash
npm run build:vite   # dist/index.html — один файл со всеми стилями и скриптами
```
Благодаря `vite-plugin-singlefile` и `base: "./"` собранный `dist/index.html`
открывается даже с диска, без сервера.

`npm run build` / `npm run start` — сборка и запуск Next.js-варианта.

## Частые причины «сайт не открывается»

| Симптом | Причина | Решение |
|---|---|---|
| Пустая страница, открыли файл | запуск `file://index.html` | `npm run dev:vite` и открыть адрес из терминала |
| `npm: command not found` | не установлен Node.js | поставить Node LTS 22+ |
| `vite: command not found` | не выполнен `npm install` | `npm install` |
| Ошибка про версию Node | Vite 7 требует Node ≥ 20.19 | обновить Node |
| Порт занят | 5173 уже используется | `npm run dev:vite -- --port 3001` |
| Данные пустые | нет таблицы в Supabase | см. ниже |
| Красная надпись «Ошибка Supabase» | нет таблицы `vodyanoy_store` | админка → синхронизация → SQL |
| `npm warn allow-scripts …` при установке | новая политика npm | это предупреждение, установка прошла |

## Настройка Supabase

1. Меню → **Админ-панель** (логин `admin`, пароль `123456789`).
2. Нажмите круглую стрелку синхронизации — появится модалка с SQL.
3. Supabase → SQL Editor → New query → вставьте SQL → **Run**.
4. Вернитесь в админку и нажмите «Проверить запись в Supabase».

Таблица `vodyanoy_store` хранит: `products`, `categories`, `loyalty_users`,
`plumbers`, `media_library`. Изображения — в публичном бакете `vodyanoy-media`.

## Структура

```
index.html, vite.config.ts     вход и конфиг Vite (как раньше)
src/
├─ main.tsx, App.tsx, index.css
├─ data/                    catalog.ts (типы + категории по умолчанию), orders.ts
├─ hooks/                   useAppRoute, useProducts, useCategories, useOrders, useLoyalty, usePlumbers, useMediaLibrary
├─ utils/                   supabase, cloudSync, imageUpload, saveCache, cn
├─ components/              ShopView, CustomerAccount, LoyaltyCard, OrdersTab, PlumbersList, PumpCalculator, AdminPanel
├─ app/                     обёртка Next.js: layout.tsx (= index.html), ClientApp.tsx (= main.tsx), [[...slug]]/page.tsx
└─ db/                      заглушка шаблона платформы (приложением не используется)
```

Обёртка Next.js монтирует `App` только в браузере (`ssr: false`), поэтому `useAppRoute`,
`localStorage` и Supabase работают ровно так же, как в Vite-версии. Все адреса
(`/catalog/...`, `/product/1`, `/admin`, `/account`, `/plumbers`) обслуживает `[[...slug]]/page.tsx`,
а маршрутизацию внутри делает `src/hooks/useAppRoute.ts`.

## Картинки

Категории и баннеры берут файлы из `public/images/`:
`cat-ppr.png`, `cat-brass.png`, `cat-valves.png`,
`banner-reputation.png`, `banner-warranty.png`, `banner-returns.png`.
Сейчас там лежат заглушки — замените их своими или загрузите файлы с теми же именами
в админке → **Медиа** (медиатека имеет приоритет над файлами в `public/images/`).

## Проверка типов

```bash
npm run check    # tsc --noEmit
```
