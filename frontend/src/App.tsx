/* eslint-disable indent */
import "@style/app.scss";
import "antd/dist/reset.css";

import { getTelegramWebApp } from "@helpers/telegram";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import Main from "./layouts/main";
import Router from "./router";

function App() {
  const tg = getTelegramWebApp();

  useEffect(() => {
    try {
      if (!tg) return;
      tg.ready();
      tg.expand();
    } catch (e) {
      // ignore
    }
  }, [tg]);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
        retry: false,
        staleTime: 5 * 60 * 1000
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Main>
        <Router />
      </Main>
    </QueryClientProvider>
  );
}

export default App;
