import { ArrowLeft } from "lucide-react";
import React from "react";

import { AppView } from "../types";

type Props = {
  currentView: AppView;
  scrolled: boolean;
  setCurrentView: React.Dispatch<React.SetStateAction<AppView>>;
  restoreHomeScroll: (behavior?: "auto" | "smooth") => void;
  shouldRestoreHomeScrollRef: React.MutableRefObject<boolean>;
};

export default function TopNav({
  currentView,
  scrolled,
  setCurrentView,
  restoreHomeScroll,
  shouldRestoreHomeScrollRef
}: Props) {
  return (
    <nav
      className={`z-[120] flex h-14 w-full max-w-md items-center justify-center px-6 transition-colors duration-300 ${
        scrolled || currentView !== "home"
          ? "blur-nav border-b border-white/10"
          : "bg-transparent"
      }`}>
      {currentView !== "home" && (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="premium-shadow absolute left-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]">
          <ArrowLeft size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setCurrentView("home");
          shouldRestoreHomeScrollRef.current = true;
          restoreHomeScroll("auto");
        }}
        className="cursor-pointer select-none"
        aria-label="На главную">
        <img
          src="/logo.svg"
          alt="Logo"
          className="logo-auto h-7 w-auto opacity-95"
        />
      </button>
    </nav>
  );
}
