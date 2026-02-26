export type TelegramUser = {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export const getTelegramInitData = (): string => window.Telegram?.WebApp?.initData ?? '';

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
