import { useEffect, useRef } from "react";
import { RouterProvider } from "react-router-dom";

import { routes } from "./routes";

type YmFn = (counterId: number, eventName: "hit", url: string) => void;

function Router() {
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const sendHit = (url: string) => {
      const { ym } = window as Window & { ym?: YmFn };
      if (typeof ym !== "function") return;
      ym(105970184, "hit", url);
    };

    lastUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const unsubscribe = routes.subscribe((state) => {
      const loc = state.location;
      const nextUrl = `${loc.pathname ?? ""}${loc.search ?? ""}${
        loc.hash ?? ""
      }`;
      if (!nextUrl) return;
      if (lastUrlRef.current === nextUrl) return;
      lastUrlRef.current = nextUrl;
      sendHit(nextUrl);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <RouterProvider router={routes} />;
}

export default Router;
