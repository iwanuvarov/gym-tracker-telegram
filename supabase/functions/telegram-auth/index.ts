import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramAuthRequest = {
  initData?: string;
};

type TelegramAuthResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  isNewUser: boolean;
};

type TelegramIdentityRow = {
  user_id: string;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const encoder = new TextEncoder();

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

const hmacSha256 = async (key: string | Uint8Array, value: string): Promise<Uint8Array> => {
  const keyBytes = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
  return new Uint8Array(signature);
};

const constantTimeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
};

const parseTelegramUser = (params: URLSearchParams): TelegramInitUser => {
  const rawUser = params.get('user');
  if (!rawUser) {
    throw new Error('initData не содержит user. Откройте Mini App через Telegram-бота.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    throw new Error('Не удалось прочитать user из initData.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('id' in parsed)) {
    throw new Error('Некорректный user в initData.');
  }

  const user = parsed as TelegramInitUser;
  if (typeof user.id !== 'number' || !Number.isFinite(user.id)) {
    throw new Error('Некорректный telegram user id.');
  }

  return user;
};

const verifyInitData = async (
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): Promise<TelegramInitUser> => {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('hash отсутствует в initData.');
  }

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number(authDateRaw) : Number.NaN;
  if (!Number.isFinite(authDate)) {
    throw new Error('auth_date отсутствует или некорректен.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authDate > nowSeconds + 30) {
    throw new Error('auth_date из будущего. Проверьте время на устройстве.');
  }

  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new Error('initData устарел. Закройте и заново откройте Mini App в Telegram.');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmacSha256('WebAppData', botToken);
  const expectedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));

  if (!constantTimeEqual(expectedHash, hash.toLowerCase())) {
    throw new Error('Неверная подпись initData.');
  }

  return parseTelegramUser(params);
};

const normalizeOptional = (value?: string): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const deriveAuthEmail = (telegramUserId: number): string => `tg_${telegramUserId}@telegram.local`;

const deriveAuthPassword = async (telegramUserId: number, secret: string): Promise<string> => {
  const digest = bytesToHex(await hmacSha256(secret, `telegram:${telegramUserId}`));
  return `${digest.slice(0, 48)}Aa1!`;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const passwordSecret = Deno.env.get('TELEGRAM_AUTH_PASSWORD_SECRET');
  const maxAgeSeconds = Number(Deno.env.get('TELEGRAM_AUTH_MAX_AGE_SECONDS') ?? '3600');

  if (!supabaseUrl || !serviceRoleKey || !botToken || !passwordSecret) {
    return jsonResponse(
      {
        error:
          'Function is not configured. Required secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_AUTH_PASSWORD_SECRET.',
      },
      500,
    );
  }

  let payload: TelegramAuthRequest;
  try {
    payload = (await request.json()) as TelegramAuthRequest;
  } catch {
    return jsonResponse({ error: 'Некорректный JSON body.' }, 400);
  }

  const initData = payload.initData?.trim() ?? '';
  if (!initData) {
    return jsonResponse({ error: 'initData обязателен.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const telegramUser = await verifyInitData(initData, botToken, maxAgeSeconds);
    const email = deriveAuthEmail(telegramUser.id);
    const password = await deriveAuthPassword(telegramUser.id, passwordSecret);

    const identityResult = await admin
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', telegramUser.id)
      .maybeSingle<TelegramIdentityRow>();

    if (identityResult.error && identityResult.error.code !== 'PGRST116') {
      throw identityResult.error;
    }

    let userId = identityResult.data?.user_id ?? null;
    let isNewUser = false;

    if (!userId) {
      const createdUserResult = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_user_id: telegramUser.id,
          username: normalizeOptional(telegramUser.username),
          first_name: normalizeOptional(telegramUser.first_name),
          last_name: normalizeOptional(telegramUser.last_name),
        },
      });

      if (createdUserResult.error) {
        throw createdUserResult.error;
      }

      userId = createdUserResult.data.user.id;
      isNewUser = true;
    }

    const identityUpsert = await admin.from('telegram_identities').upsert(
      {
        telegram_user_id: telegramUser.id,
        user_id: userId,
        username: normalizeOptional(telegramUser.username),
        first_name: normalizeOptional(telegramUser.first_name),
        last_name: normalizeOptional(telegramUser.last_name),
        last_auth_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_user_id' },
    );

    if (identityUpsert.error) {
      throw identityUpsert.error;
    }

    const updateUserResult = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        telegram_user_id: telegramUser.id,
        username: normalizeOptional(telegramUser.username),
        first_name: normalizeOptional(telegramUser.first_name),
        last_name: normalizeOptional(telegramUser.last_name),
      },
    });

    if (updateUserResult.error) {
      throw updateUserResult.error;
    }

    const signInResult = await admin.auth.signInWithPassword({ email, password });
    if (signInResult.error || !signInResult.data.session) {
      throw signInResult.error ?? new Error('Не удалось создать сессию Supabase.');
    }

    const responsePayload: TelegramAuthResponse = {
      accessToken: signInResult.data.session.access_token,
      refreshToken: signInResult.data.session.refresh_token,
      userId,
      isNewUser,
    };

    return jsonResponse(responsePayload, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[telegram-auth] failed', message);
    return jsonResponse({ error: message }, 400);
  }
});
