import React, { useState, useMemo, useEffect } from "react";
import {
  ShoppingBag,
  Search,
  X,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter
} from "lucide-react";

import Api from "@framework/api/utils/api-config";

import type { GetProductsResponse, Product as BackendProduct } from "../types";
import type { Product, AppView, CartItem, Category, SortOption } from "./types";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("Все");
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("brand-az");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_LIMIT = 200;

  const mapBackendToUiProduct = (p: BackendProduct): Product => ({
    id: p.id,
    name: p.title,
    brand: p.brand,
    category: p.category,
    price: p.price,
    images: (p.photos || []).map((photo) => photo.url),
    description: p.description,
    details: []
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await Api.get<GetProductsResponse>(
          "https://back-unique.vercel.app/products",
          {
          params: {
            page: 1,
            limit: DEFAULT_LIMIT
          },
          timeout: 30000
          }
        );
        const backendProducts: BackendProduct[] = data.products || [];
        const mapped = backendProducts.map(mapBackendToUiProduct);
        setProducts(mapped);
      } catch (e: any) {
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "Не удалось загрузить товары";
        setError(String(message));
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, []);

  const categories = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["Все", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const brands = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return ["Все", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter((p) => {
      const matchesCategory = activeCategory === "Все" || p.category === activeCategory;
      const matchesBrand = activeBrand === "Все" || p.brand === activeBrand;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesBrand && matchesSearch;
    });

    switch (sortOption) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "brand-az":
        result.sort((a, b) => a.brand.localeCompare(b.brand));
        break;
      default:
        break;
    }
    return result;
  }, [activeCategory, activeBrand, searchQuery, sortOption]);

  const addToCart = (product: Product) => {
    setCart((prev: CartItem[]) => {
      const existing = prev.find((item: CartItem) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev: CartItem[]) =>
      prev
        .map((item: CartItem) => {
          if (item.id === id) {
            const newQty = Math.max(0, item.quantity + delta);
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce(
    (sum: number, item: CartItem) => sum + item.price * item.quantity,
    0
  );
  const cartCount = cart.reduce(
    (sum: number, item: CartItem) => sum + item.quantity,
    0
  );

  const navigateToProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
    setCurrentView("product-detail");
    window.scrollTo(0, 0);
  };

  const HomeView = () => (
    <div className="pb-32 pt-28 animate-in fade-in duration-700">
      <div className="px-6 mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Что вы ищете?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-100 py-4 px-6 pr-12 text-sm rounded-2xl focus:ring-1 focus:ring-black outline-none transition-all premium-shadow"
          />
          <Search
            size={18}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-300"
          />
        </div>
      </div>

      <div className="px-6 mb-8 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-8 items-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-[10px] uppercase tracking-[0.25em] transition-all font-black ${
              activeCategory === cat ? "text-black scale-110" : "text-neutral-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="px-6 mb-10 flex items-center justify-between gap-4">
        <div className="relative flex-1 group">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full appearance-none bg-white border border-neutral-100 py-3.5 pl-5 pr-10 text-[10px] uppercase tracking-widest rounded-2xl focus:ring-1 focus:ring-black outline-none transition-all text-neutral-900 font-extrabold premium-shadow cursor-pointer"
          >
            <option value="Все">Бренд: Все</option>
            {brands
              .filter((b) => b !== "Все")
              .map((brand: string) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none group-hover:text-black transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsSortOpen(true)}
          className="w-12 h-12 flex items-center justify-center bg-white border border-neutral-100 rounded-2xl hover:bg-neutral-50 transition-colors premium-shadow"
        >
          <Filter size={18} />
        </button>
      </div>

      <div className="px-6 grid grid-cols-2 gap-x-5 gap-y-10">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => (
            <div
              key={product.id}
              className="cursor-pointer active:scale-95 transition-transform duration-300"
              onClick={() => navigateToProduct(product)}
            >
              <div className="aspect-[4/5] overflow-hidden mb-5 bg-neutral-100 rounded-[2.5rem] relative premium-shadow">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-400 font-black mb-1">
                  {product.brand}
                </p>
                <h3 className="text-sm font-bold tracking-tight text-neutral-900 line-clamp-1">
                  {product.name}
                </h3>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-40 text-center">
            <p className="text-neutral-300 text-sm font-medium tracking-wide">
              Ничего не найдено
            </p>
          </div>
        )}
      </div>

      {isSortOpen && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setIsSortOpen(false)}
          />
          <div className="relative w-full bg-white rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <div className="w-16 h-1.5 bg-neutral-100 rounded-full mx-auto mb-10" />
            <div className="flex justify-between items-center mb-12">
              <h4 className="text-3xl font-black">Сортировка</h4>
              <button
                type="button"
                onClick={() => setIsSortOpen(false)}
                className="p-3 bg-neutral-50 rounded-full text-neutral-400 hover:text-black transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Бренд (А-Я)", id: "brand-az" },
                { label: "Новинки", id: "newest" },
                { label: "Цена: по возрастанию", id: "price-asc" },
                { label: "Цена: по убыванию", id: "price-desc" }
              ].map((opt: { label: string; id: SortOption | string }) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortOption(opt.id as SortOption);
                    setIsSortOpen(false);
                  }}
                  className={`w-full py-6 px-8 rounded-3xl text-left flex justify-between items-center transition-all ${
                    sortOption === opt.id
                      ? "bg-black text-white shadow-xl translate-x-2"
                      : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  <span className="text-xs uppercase tracking-[0.2em] font-black">
                    {opt.label}
                  </span>
                  {sortOption === opt.id && (
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const ProductDetailView = () => {
    if (!selectedProduct) return null;
    return (
      <div className="pb-48 animate-in slide-in-from-right duration-500 bg-white">
        <div className="fixed top-0 max-w-md w-full px-6 py-6 flex items-center justify-between z-[100] blur-nav">
          <button
            type="button"
            onClick={() => setCurrentView("home")}
            className="p-3 bg-white/50 border border-neutral-100 rounded-2xl premium-shadow hover:scale-110 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className="p-3 bg-white/50 border border-neutral-100 rounded-2xl premium-shadow"
          >
            <ShoppingBag size={20} />
          </button>
        </div>

        <div className="relative w-full aspect-[4/5] overflow-hidden">
          <img
            src={selectedProduct.images[currentImageIndex]}
            alt={selectedProduct.name}
            className="w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />

          {selectedProduct.images.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-between items-center pointer-events-none">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === 0 ? selectedProduct.images.length - 1 : prev - 1
                  );
                }}
                className="p-4 bg-white/60 backdrop-blur-xl border border-white rounded-3xl premium-shadow pointer-events-auto active:scale-90 transition-transform"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2.5">
                {selectedProduct.images.map((_, i) => (
                  <span
                    key={String(i)}
                    className={`h-1.5 transition-all duration-500 rounded-full ${
                      i === currentImageIndex ? "w-8 bg-black" : "w-2 bg-black/10"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === selectedProduct.images.length - 1 ? 0 : prev + 1
                  );
                }}
                className="p-4 bg-white/60 backdrop-blur-xl border border-white rounded-3xl premium-shadow pointer-events-auto active:scale-90 transition-transform"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="px-8 -mt-8 relative z-10 bg-white rounded-t-[3rem] pt-12">
          <div className="flex justify-between items-start mb-10">
            <div className="max-w-[70%]">
              <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400 font-black mb-3">
                {selectedProduct.brand}
              </p>
              <h2 className="text-4xl font-black leading-none tracking-tighter">
                {selectedProduct.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-black">
                {selectedProduct.price.toLocaleString()} ₽
              </p>
              <span className="h-1 w-8 bg-black ml-auto mt-2 block" />
            </div>
          </div>

          <p className="text-[15px] text-neutral-500 leading-relaxed mb-12 font-medium">
            {selectedProduct.description}
          </p>

          <div className="space-y-8 mb-12">
            <h4 className="text-[11px] uppercase tracking-[0.35em] font-black text-neutral-300">
              Особенности
            </h4>
            <div className="grid grid-cols-1 gap-5">
              {selectedProduct.details.map((detail, i) => (
                <div
                  key={String(i)}
                  className="flex items-center gap-5 p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 transition-all hover:translate-x-2"
                >
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center premium-shadow font-black text-xs text-neutral-300">
                    0
                    {i + 1}
                  </div>
                  <span className="text-[13px] font-bold text-neutral-800">{detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-[70px] left-0 right-0 max-w-md mx-auto px-6 pb-6 pt-4 bg-gradient-to-t from-white via-white/90 to-transparent z-[85]">
            <button
              type="button"
              onClick={() => {
                addToCart(selectedProduct);
                setCurrentView("cart");
              }}
              className="w-full py-6 bg-black text-white text-xs uppercase tracking-[0.3em] font-black rounded-3xl active:scale-95 transition-all shadow-2xl shadow-black/40 hover:bg-neutral-900"
            >
              В корзину
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CartView = () => (
    <div className="pt-28 pb-32 px-8 min-h-screen animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-12">
        <h2 className="text-5xl font-black tracking-tight">Сумка</h2>
        <span className="text-neutral-300 font-black text-lg">{cartCount}</span>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="w-32 h-32 bg-neutral-50 rounded-[3rem] flex items-center justify-center mb-10 premium-shadow">
            <ShoppingBag size={40} className="text-neutral-200" />
          </div>
          <p className="text-neutral-400 mb-12 font-bold tracking-tight">
            Ваша корзина пуста
          </p>
          <button
            type="button"
            onClick={() => setCurrentView("home")}
            className="px-12 py-5 bg-black text-white text-[10px] uppercase tracking-[0.3em] font-black rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            В каталог
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8 mb-16">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-8 items-center group">
                <div className="w-28 h-32 bg-neutral-50 rounded-[2rem] overflow-hidden premium-shadow flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={item.images[0]}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.3em] text-neutral-400 font-black mb-1">
                        {item.brand}
                      </p>
                      <h4 className="text-[15px] font-black leading-tight mb-1">
                        {item.name}
                      </h4>
                      <p className="text-sm font-bold text-neutral-800">
                        {item.price.toLocaleString()} ₽
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -item.quantity)}
                      className="text-neutral-200 hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 bg-neutral-50 self-start px-2 py-1.5 rounded-2xl border border-neutral-100">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-2 hover:bg-white rounded-xl transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-xs font-black min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-2 hover:bg-white rounded-xl transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-10 bg-black text-white rounded-[3.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] mb-10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-400 text-[10px] uppercase tracking-[0.4em] font-black">
                Сумма заказа
              </span>
              <span className="text-3xl font-black">{cartTotal.toLocaleString()} ₽</span>
            </div>
            <p className="text-[10px] text-neutral-600 mb-12 uppercase tracking-widest font-black">
              включая доставку из Милана
            </p>
            <button
              type="button"
              className="w-full py-6 bg-white text-black text-[11px] uppercase tracking-[0.4em] font-black rounded-2xl active:scale-95 transition-all shadow-xl hover:bg-neutral-100"
            >
              Оформить
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (loading && products.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center text-white">
        Загрузка каталога...
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center gap-3 text-center text-white px-4">
        <div>{error}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white text-black text-xs uppercase tracking-[0.3em] font-black rounded-2xl"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen relative overflow-x-hidden">
      <nav
        className={`fixed top-0 max-w-md w-full z-[120] flex items-center justify-between px-8 py-7 transition-all duration-500 ${
          scrolled || currentView !== "home"
            ? "blur-nav bg-white/80 py-4 border-b border-neutral-100"
            : "bg-transparent"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setCurrentView("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="cursor-pointer hover:opacity-50 transition-all"
        >
          <img src="/logo.svg" alt="YEEZYUNIQUE" className="h-8" />
        </button>
        {currentView === "home" && (
          <button
            type="button"
            className="relative cursor-pointer"
            onClick={() => setCurrentView("cart")}
          >
            <ShoppingBag size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </nav>

      <main>
        {currentView === "home" && <HomeView />}
        {currentView === "product-detail" && <ProductDetailView />}
        {currentView === "cart" && <CartView />}
      </main>

      <div className="fixed bottom-0 max-w-md w-full px-12 pb-6 pt-2 z-[110] flex justify-center">
        <div className="bg-black/95 blur-nav px-12 py-3 rounded-[2rem] flex items-center gap-16 shadow-2xl border border-white/10">
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`transition-all ${
              currentView === "home" ? "text-white scale-125" : "text-neutral-500 hover:text-white"
            }`}
          >
            <Search size={22} strokeWidth={currentView === "home" ? 3 : 2} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentView("cart")}
            className={`relative transition-all ${
              currentView === "cart" ? "text-white scale-125" : "text-neutral-500 hover:text-white"
            }`}
          >
            <ShoppingBag size={22} strokeWidth={currentView === "cart" ? 3 : 2} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-black text-[6px] w-3 h-3 rounded-full flex items-center justify-center font-black">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;


