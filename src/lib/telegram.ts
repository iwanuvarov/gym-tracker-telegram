export type TelegramUser = {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export const getTelegramInitData = (): string => window.Telegram?.WebApp?.initData ?? '';

const getSearchParam = (source: string, key: string): string | null => {
  const value = source.trim();
  if (!value) {
    return null;
  }

  const normalized = value.startsWith('?') || value.startsWith('#') ? value.slice(1) : value;
  const query = normalized.includes('?') ? normalized.slice(normalized.indexOf('?') + 1) : normalized;
  const param = new URLSearchParams(query).get(key);
  if (!param) {
    return null;
  }

  const trimmed = param.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getTelegramStartParam = (): string | null => {
  const unsafeValue = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (unsafeValue?.trim()) {
    return unsafeValue.trim();
  }

  return (
    getSearchParam(window.location.search, 'tgWebAppStartParam') ??
    getSearchParam(window.location.search, 'startapp') ??
    getSearchParam(window.location.hash, 'tgWebAppStartParam') ??
    getSearchParam(window.location.hash, 'startapp')
  );
};

export const openTelegramLink = (url: string): void => {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const initTelegramWebApp = (): TelegramUser | null => {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return null;
  }

  webApp.ready();
  webApp.expand();
  webApp.enableClosingConfirmation();

  const unsafe = webApp.initDataUnsafe?.user;
  if (!unsafe?.id) {
    return null;
  }

  return {
    id: unsafe.id,
    username: unsafe.username,
    firstName: unsafe.first_name,
    lastName: unsafe.last_name,
  };
};
