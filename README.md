# Gym Tracker Telegram Mini App

Отдельный проект для Telegram Mini App версии Gym Tracker.

## Что уже есть
- React + TypeScript (strict) + Vite каркас
- Telegram WebApp SDK инициализация
- Supabase клиент
- Zustand store
- MVP-экран:
  - Telegram login (через `initData` + Supabase Edge Function)
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

## Настройка Telegram auth
1. Применить миграцию:
```bash
supabase db push
```
2. Деплой edge function:
```bash
supabase functions deploy telegram-auth
```
3. Задать secrets для функции:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_AUTH_PASSWORD_SECRET=...
```

Функция `telegram-auth`:
- валидирует подпись `initData` от Telegram,
- создает/находит пользователя Supabase Auth,
- привязывает `telegram_user_id` в `telegram_identities`,
- возвращает `access/refresh` токены, которые фронт сохраняет как обычную сессию Supabase.

## Связь с мобильным проектом
- Можно использовать тот же Supabase проект, те же таблицы и RLS-политики.
- В Telegram-проекте уже добавлена миграция `telegram_identities`.
