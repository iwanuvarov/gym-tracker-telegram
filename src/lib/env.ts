const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const telegramBotUsernameRaw = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  telegramBotUsername: (telegramBotUsernameRaw ?? '').trim().replace(/^@/, ''),
};
