import type { TelegramType, WebApp } from "../types";

export function getTelegramWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;

  const tg = (window as unknown as { Telegram?: TelegramType }).Telegram;
  return tg?.WebApp ?? null;
}

export function isInTelegramWebView(): boolean {
  return !!getTelegramWebApp();
}
