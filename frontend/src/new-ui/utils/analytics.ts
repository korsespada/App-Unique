const YANDEX_METRIKA_COUNTER_ID = 105970184;

type AnalyticsParams = Record<string, unknown>;

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  try {
    window.va?.("track", eventName, params);
  } catch {
    // ignore
  }

  try {
    window.ym?.(YANDEX_METRIKA_COUNTER_ID, "reachGoal", eventName, params);
  } catch {
    // ignore
  }
}

export function trackPageView(path: string, title: string) {
  const pagePath = String(path || "/") || "/";
  const pageTitle = String(title || "") || "";

  try {
    window.va?.("track", "pageview", {
      path: pagePath,
      title: pageTitle
    });
  } catch {
    // ignore
  }

  try {
    window.ym?.(YANDEX_METRIKA_COUNTER_ID, "hit", pagePath, {
      title: pageTitle
    });
  } catch {
    // ignore
  }
}
