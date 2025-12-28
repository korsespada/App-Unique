import "@style/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import App from "./new-ui/App";
import { TelegramType } from "./new-ui/types";

declare global {
  interface Window {
    Telegram?: TelegramType;
  }
}

const container = document.getElementById("root") as HTMLElement;

const queryClient = new QueryClient();

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
