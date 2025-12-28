import "@style/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import ym from "react-yandex-metrika";

import App from "./new-ui/App";
import { TelegramType } from "./new-ui/types";

declare global {
  interface Window {
    Telegram?: TelegramType;
  }
}

const container = document.getElementById("root") as HTMLElement;

const queryClient = new QueryClient();

function MetrikaProvider() {
  useEffect(() => {
    let userId: number | undefined;

    try {
      userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    } catch {
      userId = undefined;
    }

    try {
      ym("init", {
        id: 105970184,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
        userParams: userId ? { userId } : undefined
      });
    } catch {
      // ignore
    }
  }, []);

  return null;
}

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <MetrikaProvider />
    <App />
  </QueryClientProvider>
);
