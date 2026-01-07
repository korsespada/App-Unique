import "@style/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import App from "./new-ui/App";
import { trackPageView } from "./new-ui/utils/analytics";

function TelegramAnalytics() {
  useEffect(() => {
    // Отслеживаем изменения view через custom events
    const handleViewChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { view, productId } = customEvent.detail;

      let pagePath = "/";
      let pageTitle = "Home";

      switch (view) {
        case "product-detail":
          pagePath = `/product/${productId}`;
          pageTitle = `Product ${productId}`;
          break;
        case "cart":
          pagePath = "/cart";
          pageTitle = "Cart";
          break;
        case "favorites":
          pagePath = "/favorites";
          pageTitle = "Favorites";
          break;
        case "home":
        default:
          pagePath = "/";
          pageTitle = "Home";
          break;
      }

      trackPageView(pagePath, pageTitle);
    };

    window.addEventListener("telegram-view-change", handleViewChange);

    // Initial page view
    window.dispatchEvent(
      new CustomEvent("telegram-view-change", {
        detail: { view: "home" }
      })
    );

    return () => {
      window.removeEventListener("telegram-view-change", handleViewChange);
    };
  }, []);

  return null;
}

const container = document.getElementById("root") as HTMLElement;

const queryClient = new QueryClient();

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <TelegramAnalytics />
    <App />
    <Analytics />
    <SpeedInsights />
  </QueryClientProvider>
);
