interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData?: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: TelegramWebAppUser;
          start_param?: string;
          auth_date?: string;
          hash?: string;
        };
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          isVisible: boolean;
        };
        // Add other WebApp properties as needed
      };
    };
  }
}

// This export statement is necessary to make this file a module.
export {};
