import {
  ArrowLeftOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
  ShoppingCartOutlined
} from "@ant-design/icons";
import { Button, Select } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ExternalProduct } from "@framework/types";

type AppView = "home" | "product-detail" | "cart";

type CartItem = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  images: string[];
  price?: number;
  quantity: number;
};

function getProductName(p: ExternalProduct) {
  return p.title || p.name || p.description || "";
}

function getProductId(p: ExternalProduct) {
  return p.product_id || p.id || "";
}

function getProductBrand(p: ExternalProduct) {
  return p.brand || p.season_title || "";
}

function getProductPrice(p: ExternalProduct) {
  // В external-products сейчас нет реальной цены — оставляем undefined,
  // UI просто не будет показывать цену.
  return undefined;
}

interface Props {
  products: ExternalProduct[];

  categories: string[];
  brandLines: string[];

  selectedCategory?: string;
  selectedBrandLine?: string;
  searchQuery: string;

  onSearch: (value: string) => void;
  onCategoryChange: (value: string | undefined) => void;
  onBrandLineChange: (value: string | undefined) => void;
  onClearFilters: () => void;
}

export default function GaShop({
  products,
  categories,
  brandLines,
  selectedCategory,
  selectedBrandLine,
  searchQuery,
  onSearch,
  onCategoryChange,
  onBrandLineChange,
  onClearFilters
}: Props) {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<ExternalProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const galleryContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const swipingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const dragOffsetPxRef = useRef(0);

  const filteredAndSortedProducts = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();

    const result = products.filter((p) => {
      const categoryOk = !selectedCategory || p.category === selectedCategory;
      const brandValue = getProductBrand(p);
      const brandOk = !selectedBrandLine || brandValue === selectedBrandLine;

      if (!q) {
        return categoryOk && brandOk;
      }

      const haystack = `${p.title || ""} ${p.name || ""} ${p.description || ""} ${
        p.category || ""
      } ${brandValue} ${getProductId(p)}`
        .toLowerCase()
        .trim();

      return categoryOk && brandOk && haystack.includes(q);
    });

    return result;
  }, [products, searchQuery, selectedCategory, selectedBrandLine]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const navigateToProduct = (product: ExternalProduct) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
    setCurrentView("product-detail");
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (currentView !== "product-detail") return;
    setDragOffsetPx(0);
    dragOffsetPxRef.current = 0;
  }, [currentView, selectedProduct]);

  const clampImageIndex = (idx: number, imagesLen: number) => {
    if (imagesLen <= 0) return 0;
    return Math.max(0, Math.min(imagesLen - 1, idx));
  };

  const addToCart = (product: ExternalProduct) => {
    const id = getProductId(product);
    const name = getProductName(product);
    const brand = getProductBrand(product) || undefined;
    const price = getProductPrice(product);

    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [
        ...prev,
        {
          id,
          name,
          brand,
          category: product.category,
          description: product.description,
          images: product.images || [],
          price,
          quantity: 1
        }
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const qty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: qty };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const HomeView = () => (
    <div className="pb-24">
      <div className="px-4 pt-16 mb-4">
        <div className="relative">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Поиск по коллекции..."
            value={searchQuery}
            onChange={(e) => {
              onSearch(e.target.value);
              try {
                requestAnimationFrame(() => searchInputRef.current?.focus());
              } catch (e) {
                // ignore
              }
            }}
            className="w-full bg-gray-50 border-none py-3 pl-10 pr-3 text-sm rounded-2xl focus:ring-1 focus:ring-black outline-none text-black placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="px-4 mb-4 overflow-x-auto whitespace-nowrap flex gap-4 border-b border-gray-50">
        <button
          type="button"
          onClick={() => onCategoryChange(undefined)}
          className={`pb-3 text-[11px] uppercase tracking-[0.2em] font-bold ${
            !selectedCategory ? "border-b-2 border-black text-black" : "text-gray-400"
          }`}
        >
          Все
        </button>
        {categories.map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`pb-3 text-[11px] uppercase tracking-[0.2em] font-bold ${
              selectedCategory === cat ? "border-b-2 border-black text-black" : "text-gray-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="px-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex-1">
          <Select
            placeholder="Бренд"
            className="w-full"
            value={selectedBrandLine}
            onChange={(v) => onBrandLineChange(v)}
            allowClear
            options={brandLines.map((b) => ({ value: b, label: b }))}
          />
        </div>
      </div>

      {(selectedCategory || selectedBrandLine || searchQuery) && (
        <div className="px-4 mb-4">
          <Button type="text" danger onClick={onClearFilters}>
            Сбросить фильтры
          </Button>
        </div>
      )}

      <div className="px-4 grid grid-cols-2 gap-x-4 gap-y-6">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((p) => {
            const pid = getProductId(p);
            const name = getProductName(p);
            const brand = getProductBrand(p);
            const img = p.images?.[0];

            return (
              <div
                key={pid}
                className="cursor-pointer"
                onClick={() => navigateToProduct(p)}
              >
                <div className="aspect-[3/4] overflow-hidden mb-3 bg-gray-50 rounded-3xl relative">
                  {img ? (
                    <img src={img} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                      Нет фото
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {brand && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-extrabold truncate">
                      {brand}
                    </p>
                  )}
                  <h3 className="text-[13px] font-bold tracking-tight truncate leading-tight">
                    {name || "—"}
                  </h3>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-16 text-center">
            <p className="text-gray-300 italic text-sm">Ничего не найдено</p>
          </div>
        )}
      </div>
    </div>
  );

  const ProductDetailView = () => {
    if (!selectedProduct) return null;

    const name = getProductName(selectedProduct);
    const brand = getProductBrand(selectedProduct);
    const images = selectedProduct.images || [];

    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (images.length <= 1) return;
      pointerIdRef.current = e.pointerId;
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
      swipingRef.current = false;
      setIsDragging(true);
      dragOffsetPxRef.current = 0;
      setDragOffsetPx(0);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (e) {
        // ignore
      }
    };

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (pointerIdRef.current !== e.pointerId) return;
      const startX = pointerStartXRef.current;
      const startY = pointerStartYRef.current;
      if (startX === null || startY === null) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!swipingRef.current) {
        if (Math.abs(dx) < 6) return;
        swipingRef.current = Math.abs(dx) >= Math.abs(dy);
      }

      if (!swipingRef.current) return;

      // В Telegram WebView свайп часто уходит в скролл/drag картинки —
      // явно блокируем дефолтное поведение, когда распознали горизонтальный свайп.
      try {
        e.preventDefault();
      } catch (e) {
        // ignore
      }

      const containerWidth = galleryContainerRef.current?.clientWidth || 0;
      const maxOffset = containerWidth ? containerWidth * 0.6 : 200;
      const clamped = Math.max(-maxOffset, Math.min(maxOffset, dx));
      dragOffsetPxRef.current = clamped;
      setDragOffsetPx(clamped);
    };

    const finishDrag = () => {
      if (pointerIdRef.current === null) return;
      const containerWidth = galleryContainerRef.current?.clientWidth || 0;
      const threshold = containerWidth ? containerWidth * 0.18 : 60;

      const finalOffset = dragOffsetPxRef.current;

      if (finalOffset <= -threshold) {
        setCurrentImageIndex((prev) => clampImageIndex(prev + 1, images.length));
      } else if (finalOffset >= threshold) {
        setCurrentImageIndex((prev) => clampImageIndex(prev - 1, images.length));
      }

      setIsDragging(false);
      dragOffsetPxRef.current = 0;
      setDragOffsetPx(0);
      pointerIdRef.current = null;
      pointerStartXRef.current = null;
      pointerStartYRef.current = null;
      swipingRef.current = false;
    };

    const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (pointerIdRef.current !== e.pointerId) return;
      finishDrag();
    };

    const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (pointerIdRef.current !== e.pointerId) return;
      finishDrag();
    };

    return (
      <div className="pt-16 pb-32">
        <div className="px-4 mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentView("home")}
            className="py-2 flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeftOutlined />
            <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold">Каталог</span>
          </button>
        </div>

        <div className="relative w-full aspect-[4/5] bg-gray-50 overflow-hidden">
          {images.length > 0 ? (
            <div
              ref={galleryContainerRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              className="w-full h-full overflow-hidden"
              style={{ touchAction: "pan-y" }}
            >
              <div
                className="flex w-full h-full"
                style={{
                  transform: `translate3d(${-(currentImageIndex * 100)}%, 0, 0) translate3d(${dragOffsetPx}px, 0, 0)`,
                  transition: isDragging ? "none" : "transform 250ms ease"
                }}
              >
                {images.map((img, i) => (
                  <div key={`${img}-${i}`} className="w-full h-full flex-shrink-0">
                    <img
                      src={img}
                      alt={name}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              Нет фото
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="px-4 flex gap-3 mt-4 overflow-x-auto">
            {images.slice(0, 12).map((img, i) => (
              <button
                type="button"
                key={`${img}-${i}`}
                onClick={() => {
                  setCurrentImageIndex(i);
                  dragOffsetPxRef.current = 0;
                  setDragOffsetPx(0);
                }}
                className={`w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentImageIndex ? "border-black" : "border-transparent opacity-70"
                }`}
              >
                <img src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-4">
          {brand && (
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-extrabold mb-2">
              {brand}
            </p>
          )}
          <h2 className="text-2xl font-extrabold tracking-tight">{name || "—"}</h2>

          <div className="h-px bg-gray-50 my-3" />

          {selectedProduct.description && (
            <p className="text-sm text-gray-600 leading-[1.7] mb-4 font-normal text-justify">
              {selectedProduct.description}
            </p>
          )}

          <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-3 bg-white/90 backdrop-blur-xl z-[85]">
            <button
              type="button"
              onClick={() => {
                addToCart(selectedProduct);
                setCurrentView("cart");
              }}
              className="w-full py-4 bg-black text-white text-[12px] uppercase tracking-[0.3em] font-black rounded-[20px] active:scale-95"
            >
              Добавить в корзину
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CartView = () => (
    <div className="pt-16 pb-24 px-4 min-h-screen text-black">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-extrabold">Корзина</h2>
        <button
          type="button"
          onClick={() => setCurrentView("home")}
          className="text-gray-500"
        >
          <ArrowLeftOutlined />
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCartOutlined className="text-3xl text-gray-200 mb-4" />
          <p className="text-gray-400 mb-8 italic font-medium">Корзина пока пустая.</p>
          <button
            type="button"
            onClick={() => setCurrentView("home")}
            className="px-10 py-3 bg-black text-white text-[10px] uppercase tracking-[0.3em] font-black rounded-2xl"
          >
            К покупкам
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 bg-white border border-gray-50 rounded-[24px] shadow-sm">
                <div className="w-20 h-24 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden">
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Нет фото</div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between py-1">
                  <div className="flex justify-between items-start">
                    <div>
                      {item.brand && (
                        <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-extrabold mb-1">
                          {item.brand}
                        </p>
                      )}
                      <h4 className="text-[14px] font-extrabold tracking-tight leading-tight">{item.name}</h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -item.quantity)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                      <DeleteOutlined />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center bg-gray-50 rounded-xl px-2">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-2 text-gray-500 hover:text-black">
                        <MinusOutlined />
                      </button>
                      <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-2 text-gray-500 hover:text-black">
                        <PlusOutlined />
                      </button>
                    </div>

                    {typeof item.price === "number" && (
                      <p className="text-sm font-black tracking-tighter">{(item.price * item.quantity).toLocaleString()} ₽</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cartTotal > 0 && (
            <div className="p-6 bg-black text-white rounded-[32px] shadow-2xl shadow-black/20">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-[11px] uppercase tracking-[0.3em] font-extrabold">Итого</span>
                <span className="text-2xl font-extrabold tracking-tight">{cartTotal.toLocaleString()} ₽</span>
              </div>
              <button type="button" className="w-full py-4 bg-white text-black text-[12px] uppercase tracking-[0.3em] font-black rounded-2xl active:scale-95">
                Оформить заказ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="w-full bg-white min-h-screen relative overflow-x-hidden text-black">
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-xl z-[60] flex items-center justify-center px-4 py-4 border-b border-gray-50/50">
        <button
          type="button"
          onClick={() => {
            setCurrentView("home");
            onClearFilters();
          }}
          className="cursor-pointer hover:opacity-70 transition-all"
        >
          <img src="/logo.svg" alt="YEEZYUNIQUE" className="h-9" />
        </button>
      </nav>

      <main className="min-h-screen">
        {currentView === "home" && HomeView()}
        {currentView === "product-detail" && ProductDetailView()}
        {currentView === "cart" && CartView()}
      </main>

      <div className="fixed bottom-0 w-full h-16 bg-white/95 backdrop-blur-md border-t border-gray-100 px-10 flex justify-around items-center z-[90] rounded-t-[20px] shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setCurrentView("home");
            try {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e) {
              // ignore
            }
          }}
          className={`flex flex-col items-center gap-0.5 transition-all ${
            currentView === "home" ? "text-black" : "text-gray-300"
          }`}
        >
          <SearchOutlined />
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Каталог</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView("cart")}
          className={`flex flex-col items-center gap-0.5 relative transition-all ${
            currentView === "cart" ? "text-black" : "text-gray-300"
          }`}
        >
          <ShoppingCartOutlined />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-black text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white font-black">
              {cartCount}
            </span>
          )}
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Корзина</span>
        </button>
      </div>
    </div>
  );
}
