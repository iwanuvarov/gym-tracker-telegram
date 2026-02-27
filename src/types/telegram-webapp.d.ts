declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          start_param?: string;
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
            last_name?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        openTelegramLink?: (url: string) => void;
        colorScheme?: 'light' | 'dark';
      };
    };
  }
}

export {};
