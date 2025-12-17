import "@style/index.css";

import { createRoot } from "react-dom/client";

import App from "./App";
import { TelegramType } from "./types";

declare global {
  interface Window {
    Telegram: TelegramType;
  }
}

const container = document.getElementById("root") as HTMLElement;

console.log("APP MAIN MOUNT");
createRoot(container).render(<App />);
