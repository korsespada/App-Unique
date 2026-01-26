import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import React from "react";

import { AppView, CartItem, Product } from "../types";

type Props = {
  cart: CartItem[];
  cartTotalText: string;
  orderComment: string;
  setOrderComment: (v: string) => void;
  sendOrderToManager: () => void;
  isSendingOrder: boolean;
  setCurrentView: (v: AppView) => void;
  restoreHomeScroll: (behavior?: "auto" | "smooth") => void;
  navigateToProduct: (p: Product) => void;
  getThumbUrl: (url: string, thumb?: string) => string;
  updateQuantity: (id: string, delta: number) => void;
};

export default function CartView({
  cart,
  cartTotalText,
  orderComment,
  setOrderComment,
  sendOrderToManager,
  isSendingOrder,
  setCurrentView,
  restoreHomeScroll,
  navigateToProduct,
  getThumbUrl,
  updateQuantity
}: Props) {
  return (
    <div
      className={`animate-in fade-in px-4 pb-32 pt-16 text-white duration-500 ${
        cart.length === 0 ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}>
      <div className="mb-12 flex items-baseline justify-between gap-6">
        <h2 className="text-5xl font-extrabold tracking-tight">Корзина</h2>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="premium-shadow mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5">
            <ShoppingBag size={40} className="text-white/25" />
          </div>
          <p className="text-white/55 mb-12 font-semibold tracking-tight">
            Ваша корзина пуста
          </p>
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              restoreHomeScroll();
            }}
            className="rounded-2xl bg-white px-12 py-4 text-[14px] font-extrabold uppercase tracking-normal text-black shadow-xl transition-all duration-200 ease-out [font-kerning:normal] hover:bg-white/90 active:scale-[0.98]">
            В каталог
          </button>
        </div>
      ) : (
        <>
          <div className="mb-16 space-y-8">
            {cart.map((item) => {
              const thumbUrl = getThumbUrl(String(item.thumb || ""), "240x320");
              const image0Url = getThumbUrl(
                String(item.images?.[0] || ""),
                "240x320"
              );

              return (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-center gap-8"
                  onClick={() => navigateToProduct(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}>
                  <div className="premium-shadow h-32 w-28 flex-shrink-0 overflow-hidden rounded-[1.25rem] bg-white/5 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                    <img
                      src={thumbUrl || image0Url}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const fallback = image0Url;
                        if (fallback && e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="mb-1 text-[9px] font-light uppercase tracking-[0.34em] text-white/40">
                          {item.brand}
                        </p>
                        <h4 className="mb-1 text-[15px] font-semibold leading-tight text-white">
                          {item.name}
                        </h4>
                        {item.hasPrice !== false && Number(item.price) > 0 ? (
                          <p className="text-sm font-bold text-white/80">
                            {Number(item.price).toLocaleString()} ₽
                          </p>
                        ) : (
                          <p className="text-white/55 text-[12px] font-semibold">
                            Цена по запросу
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item.id, -item.quantity);
                        }}
                        className="p-2 text-white/60 transition-colors hover:text-red-400">
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 self-start rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.quantity > 1) updateQuantity(item.id, -1);
                        }}
                        className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]">
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[20px] text-center text-xs font-semibold text-white/80">
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item.id, 1);
                        }}
                        className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-10 w-full rounded-[3.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-light uppercase tracking-[0.42em] text-white/40 [font-kerning:normal]">
                Сумма заказа
              </span>
              <span className="text-right text-[15px] font-semibold leading-tight tracking-tight text-white">
                {cartTotalText}
              </span>
            </div>
            <div className="mt-8">
              <label className="mb-3 block text-[10px] font-light uppercase tracking-[0.42em] text-white/40 [font-kerning:normal]">
                Комментарий
              </label>
              <textarea
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                rows={3}
                placeholder="Комментарий к заказу"
                className="premium-shadow placeholder:text-white/35 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[13px] font-medium text-white/80 outline-none transition-all duration-200 ease-out focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <button
              onClick={sendOrderToManager}
              disabled={isSendingOrder}
              className="mt-6 w-full rounded-2xl bg-white py-6 text-[14px] font-extrabold uppercase tracking-normal text-black shadow-xl transition-all duration-200 ease-out [font-kerning:normal] hover:bg-white/90 active:scale-[0.98] disabled:opacity-60">
              {isSendingOrder ? "Отправляем…" : "Отправить менеджеру"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
