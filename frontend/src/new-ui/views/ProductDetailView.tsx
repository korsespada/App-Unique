import {
 ArrowLeft, ChevronDown, Heart, Share 
} from "lucide-react";
import React from "react";

import tgIcon from "../tg.svg";
import { Product } from "../types";

type Props = {
  selectedProduct: Product | null;
  activeDetailLayer: "A" | "B";
  detailLayerASrc: string;
  detailLayerBSrc: string;
  isDetailImageCrossfading: boolean;
  currentImageIndex: number;
  setCurrentImageIndex: React.Dispatch<React.SetStateAction<number>>;
  touchStartXRef: React.MutableRefObject<number | null>;
  touchLastXRef: React.MutableRefObject<number | null>;
  favorites: string[];
  favoriteBumpId: string | null;
  cart: Array<{ id: string }>;
  copyProductLink: () => void;
  addToCart: (p: Product) => void;
  updateQuantity: (id: string, delta: number) => void;
  toggleFavorite: (productId: string, product?: Product) => void;
};

export default function ProductDetailView({
  selectedProduct,
  activeDetailLayer,
  detailLayerASrc,
  detailLayerBSrc,
  isDetailImageCrossfading,
  currentImageIndex,
  setCurrentImageIndex,
  touchStartXRef,
  touchLastXRef,
  favorites,
  favoriteBumpId,
  cart,
  copyProductLink,
  addToCart,
  updateQuantity,
  toggleFavorite
}: Props) {
  if (!selectedProduct) return null;

  const showA = activeDetailLayer === "A";
  const showB = !showA;

  const isFavorited = favorites.includes(String(selectedProduct.id));
  const isBumping = favoriteBumpId === String(selectedProduct.id);
  const isInCart = cart.some(
    (it) => String(it.id) === String(selectedProduct.id)
  );

  const handleGalleryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    touchLastXRef.current = touchStartXRef.current;
  };

  const handleGalleryTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    touchLastXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleGalleryTouchEnd = () => {
    const start = touchStartXRef.current;
    const end = touchLastXRef.current;
    touchStartXRef.current = null;
    touchLastXRef.current = null;
    if (start == null || end == null) return;
    const delta = start - end;
    if (Math.abs(delta) < 40) return;
    if (selectedProduct.images.length < 2) return;
    if (delta > 0) {
      setCurrentImageIndex((prev) =>
        prev === selectedProduct.images.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentImageIndex((prev) =>
        prev === 0 ? selectedProduct.images.length - 1 : prev - 1
      );
    }
  };

  return (
    <div className="animate-in slide-in-from-right bg-[#050505] pb-36 pt-0 text-white duration-500">
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        onTouchStart={handleGalleryTouchStart}
        onTouchMove={handleGalleryTouchMove}
        onTouchEnd={handleGalleryTouchEnd}>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="premium-shadow absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/40 p-2.5 text-white/90 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.98]"
          aria-label="Назад">
          <ArrowLeft size={18} />
        </button>

        <button
          type="button"
          onClick={copyProductLink}
          className="premium-shadow absolute right-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/40 p-2.5 text-white/90 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.98]"
          aria-label="Копировать ссылку">
          <Share size={18} />
        </button>

        <img
          src={detailLayerASrc}
          alt={selectedProduct.name}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
            showA ? "opacity-100" : "opacity-0"
          } ${isDetailImageCrossfading ? "" : ""}`}
          decoding="async"
        />

        <img
          src={detailLayerBSrc}
          alt={selectedProduct.name}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
            showB ? "opacity-100" : "opacity-0"
          } ${isDetailImageCrossfading ? "" : ""}`}
          decoding="async"
        />

        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

        {selectedProduct.images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setCurrentImageIndex((prev) =>
                  prev === 0 ? selectedProduct.images.length - 1 : prev - 1
                )
              }
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/40 p-3 text-white/90 backdrop-blur-2xl transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"
              aria-label="Предыдущее изображение">
              <ChevronDown size={20} className="rotate-90" />
            </button>

            <button
              type="button"
              onClick={() =>
                setCurrentImageIndex((prev) =>
                  prev === selectedProduct.images.length - 1 ? 0 : prev + 1
                )
              }
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/40 p-3 text-white/90 backdrop-blur-2xl transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"
              aria-label="Следующее изображение">
              <ChevronDown size={20} className="-rotate-90" />
            </button>
          </>
        )}

        {selectedProduct.images.length > 1 && (
          <div className="pointer-events-none absolute bottom-12 left-0 right-0 flex items-center justify-center px-6">
            <div className="flex gap-2.5">
              {selectedProduct.images.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-8 rounded-t-[3rem] bg-[#070707] px-8 pt-12">
        <div className="mb-10">
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-extralight uppercase tracking-[0.42em] text-white/40">
              {selectedProduct.brand}
            </p>
            <h2 className="text-4xl font-extrabold leading-none tracking-tight text-white">
              {selectedProduct.name}
            </h2>

            {selectedProduct.hasPrice ? (
              <p className="mt-3 text-[16px] font-extrabold text-white">
                {selectedProduct.price.toLocaleString()} ₽
              </p>
            ) : (
              <p className="mt-3 text-[13px] font-semibold tracking-normal text-white/60">
                Цена по запросу
              </p>
            )}
            <div className="mt-4 h-1 w-8 bg-white/40" />
          </div>
        </div>

        <p
          className="mb-12 text-[15px] font-medium leading-relaxed text-white/70"
          style={{ whiteSpace: "pre-line" }}>
          {selectedProduct.description}
        </p>

        <div className="mb-12 space-y-8">
          <div className="grid grid-cols-1 gap-5">
            {selectedProduct.details.map((detail, i) => (
              <div
                key={i}
                className="hover:bg-white/7 flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 ease-out hover:translate-x-1 hover:border-white/20">
                <div className="premium-shadow flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white/50">
                  0{i + 1}
                </div>
                <span className="text-white/85 text-[13px] font-semibold">
                  {detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="-mt-4 mb-6">
          <p className="mb-4 text-[15px] font-semibold text-white/75 [font-kerning:normal]">
            Не хватило деталей?
          </p>
          <a
            href={`https://t.me/htsadmin?text=${encodeURIComponent(
              `Здравствуйте, у меня вопрос по товару [${selectedProduct.name}](https://t.me/YeezyUniqueBot?startapp=product__${selectedProduct.id})`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#26adeb] py-4 text-[14px] font-extrabold uppercase tracking-normal text-white shadow-xl transition-all duration-200 ease-out [font-kerning:normal] active:scale-[0.98]">
            <img src={tgIcon} alt="" className="h-5 w-5" />
            Спросить у менеджера
          </a>
        </div>
      </div>

      <div className="fixed bottom-0 z-[130] w-full max-w-md">
        <div className="bg-black/65 rounded-t-[2.5rem] border-t border-white/10 px-6 pb-6 pt-4 backdrop-blur-2xl">
          <div className="flex items-stretch gap-4">
            <button
              type="button"
              onClick={() => {
                if (isInCart) {
                  updateQuantity(selectedProduct.id, -1);
                  return;
                }
                addToCart(selectedProduct);
              }}
              className={`flex-1 rounded-2xl py-4 text-[14px] font-extrabold uppercase tracking-normal shadow-xl transition-all duration-200 ease-out [font-kerning:normal] active:scale-[0.98] ${
                isInCart
                  ? "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  : "bg-white text-black hover:bg-white/90"
              }`}>
              {isInCart ? "Убрать из корзины" : "Добавить в корзину"}
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(selectedProduct.id, selectedProduct)}
              aria-label={
                isFavorited ? "Убрать из избранного" : "Добавить в избранное"
              }
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-200 ease-out active:scale-[0.96] ${
                isBumping ? "scale-[1.06]" : "scale-100"
              }`}>
              <Heart
                size={22}
                className={
                  isFavorited
                    ? "fill-red-500 text-red-500 transition-colors"
                    : "text-white/80 transition-colors"
                }
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
