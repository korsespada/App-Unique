/// <reference types="vite/client" />
import type { TelegramType } from "./new-ui/types";

declare global {
  interface Window {
    Telegram?: TelegramType;
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
    va?: (...args: unknown[]) => void;
  }
}

export {};
