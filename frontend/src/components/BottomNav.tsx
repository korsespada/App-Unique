import { Heart, LayoutGrid, ShoppingBag, User } from "lucide-react";
import React from "react";

import { AppView } from "../types";

type Props = {
  currentView: AppView;
  setCurrentView: React.Dispatch<React.SetStateAction<AppView>>;
  saveHomeScroll: () => void;
  restoreHomeScroll: (behavior?: "auto" | "smooth") => void;
  shouldRestoreHomeScrollRef: React.MutableRefObject<boolean>;
  cartCount: number;
};

export default function BottomNav({
  currentView,
  setCurrentView,
  saveHomeScroll,
  restoreHomeScroll,
  shouldRestoreHomeScrollRef,
  cartCount
}: Props) {
  return (
    <div className="fixed bottom-0 z-[110] flex w-full max-w-md justify-center px-4 pb-6 pt-2">
      <div className="grid w-full grid-cols-4 items-center rounded-[2rem] border border-white/10 bg-black/50 px-6 py-3 shadow-2xl backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => {
            setCurrentView("home");
            shouldRestoreHomeScrollRef.current = true;
            restoreHomeScroll("auto");
          }}
          className={`flex items-center justify-center transition-all ${currentView === "home"
              ? "scale-125 text-white"
              : "text-neutral-500 hover:text-white"
            }`}>
          <LayoutGrid size={22} strokeWidth={currentView === "home" ? 3 : 2} />
        </button>

        <button
          type="button"
          onClick={() => {
            saveHomeScroll();
            setCurrentView("favorites");
          }}
          className={`flex items-center justify-center transition-all ${currentView === "favorites"
              ? "scale-125 text-white"
              : "text-neutral-500 hover:text-white"
            }`}
          aria-label="Избранное">
          <Heart
            size={22}
            strokeWidth={currentView === "favorites" ? 3 : 2}
            className={currentView === "favorites" ? "text-white" : undefined}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            saveHomeScroll();
            setCurrentView("cart");
          }}
          className={`relative flex items-center justify-center transition-all ${currentView === "cart"
              ? "scale-125 text-white"
              : "text-neutral-500 hover:text-white"
            }`}>
          <ShoppingBag size={22} strokeWidth={currentView === "cart" ? 3 : 2} />
          {cartCount > 0 && (
            <span
              className={`absolute -top-3 left-1/2 flex translate-x-1 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-black ${cartCount > 9 ? "h-5 w-5 text-[9px]" : "h-4 w-4 text-[10px]"
                }`}>
              {cartCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            saveHomeScroll();
            setCurrentView("profile");
          }}
          className={`flex items-center justify-center transition-all ${currentView === "profile" || currentView === "orders"
              ? "scale-125 text-white"
              : "text-neutral-500 hover:text-white"
            }`}>
          <User size={22} strokeWidth={currentView === "profile" ? 3 : 2} />
        </button>
      </div>
    </div>
  );
}
