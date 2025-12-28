import { useCallback, useLayoutEffect, useRef } from "react";

export function useHomeScroll(currentView: string) {
  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);

  const saveHomeScroll = useCallback(() => {
    homeScrollYRef.current = window.scrollY || 0;
  }, []);

  const restoreHomeScroll = useCallback(
    (behavior: "auto" | "smooth" = "auto") => {
      const y = homeScrollYRef.current || 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior });
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior });
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior });
          });
        });
      });
    },
    []
  );

  const scrollHomeToTop = useCallback(
    (behavior: "auto" | "smooth" = "auto") => {
      homeScrollYRef.current = 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior });
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (currentView !== "home") return;
    if (!shouldRestoreHomeScrollRef.current) return;
    shouldRestoreHomeScrollRef.current = false;
    restoreHomeScroll("auto");
  }, [currentView, restoreHomeScroll]);

  return {
    homeScrollYRef,
    shouldRestoreHomeScrollRef,
    saveHomeScroll,
    restoreHomeScroll,
    scrollHomeToTop
  };
}
