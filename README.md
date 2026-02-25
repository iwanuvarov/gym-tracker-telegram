# Gym Tracker Telegram Mini App

Отдельный проект для Telegram Mini App версии Gym Tracker.

## Что уже есть
- React + TypeScript (strict) + Vite каркас
- Telegram WebApp SDK инициализация
- Supabase клиент
- Zustand store
- MVP-экран:
  - OTP login (fallback до Telegram auth bridge)
  - выбор `workspace_id`
  - загрузка тренировок
  - создание/удаление тренировок

## Быстрый старт
1. Установить зависимости:
```bash
npm install
```
2. Создать `.env`:
```bash
cp .env.example .env
```
3. Заполнить переменные:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
4. Запуск:
```bash
npm run dev
```

## Telegram подключение (MVP)
1. Развернуть web app по HTTPS (Vercel/Netlify/Cloudflare Pages).
2. В `@BotFather`:
   - создать/выбрать бота
   - `Menu Button` -> `Web App` -> указать URL
3. Открыть бота в Telegram и нажать кнопку меню.

## Важно про auth
Сейчас в проекте реализован `OTP fallback` для быстрого старта.
Это рабочий путь для Supabase RLS, но для продакшн Telegram Mini App нужен отдельный auth bridge:
1. Front получает `initData` из Telegram WebApp.
2. Backend проверяет подпись `initData` через bot token.
3. Backend выдает сессию приложения (или Supabase custom auth flow).

## Связь с мобильным проектом
- Можно использовать тот же Supabase проект, те же таблицы и RLS-политики.
- Рекомендовано добавить таблицу `telegram_identities` отдельной миграцией.
