import axios from "axios";

const { VITE_API_URL, VITE_API_VERSION, VITE_SHOP_NAME } = import.meta
  .env as Record<string, string | undefined>;

const defaultLegacyApiUrl = "https://app-unique.vercel.app";
const legacyApiRoot = `${
  VITE_API_URL && String(VITE_API_URL).trim()
    ? String(VITE_API_URL).trim()
    : defaultLegacyApiUrl
}/api`;
let legacyApiBasePath = legacyApiRoot;
if (VITE_API_VERSION && VITE_SHOP_NAME) {
  legacyApiBasePath = `${legacyApiRoot}/${VITE_API_VERSION}/${VITE_SHOP_NAME}`;
}

const resolvedBaseURL = legacyApiBasePath;

const Api = axios.create({
  baseURL: resolvedBaseURL,
  headers: {
    Accept: "*/*"
  }
});

Api.interceptors.request.use(
  (config) => {
    try {
      const tgInitData = (
        window as unknown as { Telegram?: { WebApp?: { initData?: unknown } } }
      )?.Telegram?.WebApp?.initData;
      if (tgInitData && typeof tgInitData === "string") {
        (config.headers as any) = config.headers || {};
        (config.headers as any)["X-Telegram-Init-Data"] = tgInitData;
      }
    } catch {
      // ignore
    }

    return config;
  },
  (err) => Promise.reject(err)
);

Api.interceptors.response.use(
  (response) => response,
  (err) => Promise.reject(err)
);

export default Api;
