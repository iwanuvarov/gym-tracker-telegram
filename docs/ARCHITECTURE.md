# Architecture Draft

## Components
- Telegram Bot (entrypoint + notifications)
- Mini App frontend (web)
- Backend API (edge/server) for Telegram initData verification
- Supabase (Postgres, Auth, RLS, RPC)

## Auth flow (target)
1. User opens Mini App from bot.
2. Mini App gets `initData` from Telegram WebApp SDK.
3. Backend verifies `initData` with bot token.
4. Backend maps Telegram user to app user and returns session/token for Supabase access.

## Data model reuse
Reuse existing entities:
- workspaces
- workspace_members
- workouts
- exercises
- sets
- workout_templates
- workout_template_exercises

## Additions (future)
- telegram_identities(user_id, telegram_user_id, username, created_at)
- possibly bot_events/audit table
