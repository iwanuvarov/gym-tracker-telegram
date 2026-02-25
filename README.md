# Gym Tracker Telegram Mini App

Отдельный проект для Telegram Mini App версии Gym Tracker.

## Цель
Сохранить текущий backend (Supabase + RLS + миграции) и вынести клиент в Telegram Mini App.

## План
1. Поднять web-клиент (Mini App) с Telegram WebApp SDK.
2. Реализовать авторизацию через Telegram initData -> backend verification.
3. Связать Telegram user с `auth.users`/профилем в Supabase.
4. Перенести ключевые флоу:
   - список тренировок
   - экран тренировки и упражнения
   - подходы
   - шаблоны
   - coach access
5. Добавить уведомления через Telegram Bot API.

## Связь с текущим мобильным проектом
- Источник данных тот же Supabase проект.
- SQL миграции и RLS остаются едиными.
- Новые таблицы для telegram-identity будут добавлены отдельными миграциями в этом репозитории.
