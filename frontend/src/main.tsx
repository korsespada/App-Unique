import "@style/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import App from "./new-ui/App";
import { TelegramType } from "./new-ui/types";

declare global {
  interface Window {
    Telegram?: TelegramType;
    va?: (
      event: string,
      action: string,
      data?: Record<string, unknown>
    ) => void;
  }
}

function RouteAnalytics() {
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.va) {
        window.va("track", "pageview", {
          path: window.location.pathname + window.location.search,
          title: document.title
        });
      }
    };

    // Отслеживаем изменение view в Telegram App
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };

    window.addEventListener("popstate", handleRouteChange);
    handleRouteChange(); // Initial page view

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  return null;
}

const container = document.getElementById("root") as HTMLElement;

const queryClient = new QueryClient();

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <RouteAnalytics />
    <App />
    <Analytics />
    <SpeedInsights />
  </QueryClientProvider>
);
