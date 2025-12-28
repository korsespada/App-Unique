import { useEffect, useRef } from "react";
import { RouterProvider } from "react-router-dom";

import { routes } from "./routes";

function Router() {
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    lastUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const unsubscribe = routes.subscribe((state) => {
      const loc = state.location;
      const nextUrl = `${loc.pathname ?? ""}${loc.search ?? ""}${
        loc.hash ?? ""
      }`;
      if (!nextUrl) return;
      if (lastUrlRef.current === nextUrl) return;
      lastUrlRef.current = nextUrl;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <RouterProvider router={routes} />;
}

export default Router;
