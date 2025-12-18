
import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, X, ArrowLeft, Plus, Minus, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, Filter } from 'lucide-react';
import { Product, AppView, CartItem, Category, SortOption } from './types';
import { PRODUCTS, CATEGORIES, BRANDS } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('Все');
  const [activeBrand, setActiveBrand] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('brand-az');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    let result = PRODUCTS.filter(p => {
      const matchesCategory = activeCategory === 'Все' || p.category === activeCategory;
      const matchesBrand = activeBrand === 'Все' || p.brand === activeBrand;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesBrand && matchesSearch;
    });

    switch (sortOption) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'brand-az': result.sort((a, b) => a.brand.localeCompare(b.brand)); break;
      default: break;
    }
    return result;
  }, [activeCategory, activeBrand, searchQuery, sortOption]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const navigateToProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
    setCurrentView('product-detail');
    window.scrollTo(0, 0);
  };

  const HomeView = () => (
    <div className="pb-32 pt-24 animate-in fade-in duration-700">
      {/* Search Header */}
      <div className="px-6 mb-10">
        <div className="relative">
          <input
            type="text"
            placeholder="Что вы ищете?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-6 pr-12 text-[13px] font-medium tracking-tight text-white placeholder:text-white/40 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
          <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35" />
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="px-6 mb-10 flex items-center gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-[10px] uppercase tracking-[0.28em] transition-all duration-200 ease-out ${activeCategory === cat ? 'text-white font-extrabold' : 'text-white/35 font-light hover:text-white/60'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Brand Select & Sort Bar */}
      <div className="px-6 mb-12 flex items-center justify-between gap-4">
        <div className="relative flex-1 group">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          >
            <option value="Все">Бренд: Все</option>
            {BRANDS.filter(b => b !== 'Все').map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-hover:text-white/60" />
        </div>

        <button
          onClick={() => setIsSortOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition-all duration-200 ease-out premium-shadow hover:bg-white/10 hover:text-white active:scale-[0.98]"
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Modern Grid */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 px-6">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map(product => (
            <div key={product.id} className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]" onClick={() => navigateToProduct(product)}>
              <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow transition-all duration-300 ease-out group-hover:border-white/20 group-hover:bg-white/7">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="px-2">
                <p className="mb-1 text-[9px] font-light uppercase tracking-[0.28em] text-white/40">{product.brand}</p>
                <h3 className="line-clamp-1 text-[13px] font-semibold tracking-tight text-white">{product.name}</h3>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-40 text-center">
            <p className="text-[13px] font-medium tracking-wide text-white/55">Ничего не найдено</p>
          </div>
        )}
      </div>

      {/* Sort Overlay */}
      {isSortOpen && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setIsSortOpen(false)} />
          <div className="relative w-full rounded-t-[3rem] border-t border-white/10 bg-[#0b0b0c] p-10 text-white shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="mx-auto mb-10 h-1.5 w-16 rounded-full bg-white/10" />
            <div className="flex justify-between items-center mb-12">
              <h4 className="text-3xl font-extrabold tracking-tight">Сортировка</h4>
              <button onClick={() => setIsSortOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-3 text-white/50 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Бренд (А-Я)', id: 'brand-az' },
                { label: 'Новинки', id: 'newest' },
                { label: 'Цена: по возрастанию', id: 'price-asc' },
                { label: 'Цена: по убыванию', id: 'price-desc' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setSortOption(opt.id as SortOption); setIsSortOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-3xl border px-8 py-6 text-left transition-all duration-200 ease-out ${sortOption === opt.id ? 'border-white/20 bg-white/10 text-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] translate-x-1' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/8 hover:text-white'}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">{opt.label}</span>
                  {sortOption === opt.id && <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />}
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
      <div className="pb-48 animate-in slide-in-from-right duration-500 bg-[#050505] text-white">
        {/* Gallery Header */}
        <div className="fixed top-0 z-[100] flex w-full max-w-md items-center justify-between px-6 py-6 blur-nav">
          <button onClick={() => setCurrentView('home')} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80 premium-shadow transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]">
            <ArrowLeft size={20} />
          </button>
          <button className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80 premium-shadow">
            <ShoppingBag size={20} />
          </button>
        </div>

        {/* Hero Image Section */}
        <div className="relative w-full aspect-[4/5] overflow-hidden">
          <img
            src={selectedProduct.images[currentImageIndex]}
            alt={selectedProduct.name}
            className="w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

          {selectedProduct.images.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-between items-center pointer-events-none">
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1)); }}
                className="pointer-events-auto rounded-3xl border border-white/15 bg-black/40 p-4 backdrop-blur-2xl premium-shadow transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2.5">
                {selectedProduct.images.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/25'}`} />
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1)); }}
                className="pointer-events-auto rounded-3xl border border-white/15 bg-black/40 p-4 backdrop-blur-2xl premium-shadow transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 -mt-8 rounded-t-[3rem] bg-[#070707] px-8 pt-12">
          <div className="flex justify-between items-start mb-10">
            <div className="max-w-[70%]">
              <p className="mb-3 text-[10px] font-extralight uppercase tracking-[0.42em] text-white/40">{selectedProduct.brand}</p>
              <h2 className="text-4xl font-extrabold leading-none tracking-tight text-white">{selectedProduct.name}</h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-white">{selectedProduct.price.toLocaleString()} ₽</p>
              <div className="ml-auto mt-2 h-1 w-8 bg-white/40" />
            </div>
          </div>

          <p className="mb-12 text-[15px] font-medium leading-relaxed text-white/70">
            {selectedProduct.description}
          </p>

          <div className="space-y-8 mb-12">
            <h4 className="text-[11px] font-light uppercase tracking-[0.35em] text-white/40">Особенности</h4>
            <div className="grid grid-cols-1 gap-5">
              {selectedProduct.details.map((detail, i) => (
                <div key={i} className="flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 ease-out hover:border-white/20 hover:bg-white/7 hover:translate-x-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white/50 premium-shadow">0{i+1}</div>
                  <span className="text-[13px] font-semibold text-white/85">{detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky Bottom Bar */}
          <div className="fixed bottom-[70px] left-0 right-0 z-[85] mx-auto max-w-md border-t border-white/10 bg-black/35 px-6 pb-6 pt-5 backdrop-blur-2xl">
            <button
              onClick={() => { addToCart(selectedProduct); setCurrentView('cart'); }}
              className="w-full rounded-3xl bg-white py-6 text-[11px] font-extrabold uppercase tracking-[0.34em] text-black shadow-2xl shadow-black/40 transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
            >
              В корзину
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CartView = () => (
    <div className="min-h-screen animate-in fade-in duration-500 px-8 pt-24 pb-32 text-white">
      <div className="flex justify-between items-end mb-12">
        <h2 className="text-5xl font-extrabold tracking-tight">Сумка</h2>
        <span className="text-lg font-semibold text-white/35">{cartCount}</span>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5 premium-shadow">
            <ShoppingBag size={40} className="text-white/25" />
          </div>
          <p className="mb-12 font-semibold tracking-tight text-white/55">Ваша корзина пуста</p>
          <button
            onClick={() => setCurrentView('home')}
            className="rounded-2xl bg-white px-12 py-5 text-[10px] font-extrabold uppercase tracking-[0.34em] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
          >
            В каталог
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8 mb-16">
            {cart.map(item => (
              <div key={item.id} className="flex gap-8 items-center group">
                <div className="h-32 w-28 flex-shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 premium-shadow transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="mb-1 text-[9px] font-light uppercase tracking-[0.34em] text-white/40">{item.brand}</p>
                      <h4 className="mb-1 text-[15px] font-semibold leading-tight text-white">{item.name}</h4>
                      <p className="text-sm font-bold text-white/80">{item.price.toLocaleString()} ₽</p>
                    </div>
                    <button onClick={() => updateQuantity(item.id, -item.quantity)} className="p-2 text-white/25 transition-colors hover:text-red-400">
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 self-start rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
                    <button onClick={() => updateQuantity(item.id, -1)} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"><Minus size={14} /></button>
                    <span className="min-w-[20px] text-center text-xs font-semibold text-white/80">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-10 rounded-[3.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-light uppercase tracking-[0.42em] text-white/40">Сумма заказа</span>
              <span className="text-3xl font-extrabold tracking-tight text-white">{cartTotal.toLocaleString()} ₽</span>
            </div>
            <p className="mb-12 text-[10px] font-light uppercase tracking-[0.42em] text-white/25">включая доставку из Милана</p>
            <button className="w-full rounded-2xl bg-white py-6 text-[11px] font-extrabold uppercase tracking-[0.42em] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]">
              Оформить
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      <nav className={`fixed top-0 max-w-md w-full z-[120] flex items-center justify-between px-8 py-7 transition-all duration-500 ${scrolled || currentView !== 'home' ? 'blur-nav py-4 border-b border-white/10' : 'bg-transparent'}`}>
        <div
          onClick={() => { setCurrentView('home'); window.scrollTo({top:0, behavior:'smooth'}); }}
          className="cursor-pointer text-[15px] font-extrabold uppercase tracking-[0.34em] text-white transition-all duration-200 ease-out hover:opacity-70"
        >
          YEEZY<span className="text-white/35">UNIQUE</span>
        </div>
        {currentView === 'home' && (
          <div className="relative cursor-pointer text-white/90 transition-colors hover:text-white" onClick={() => setCurrentView('cart')}>
            <ShoppingBag size={22} />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-white text-[8px] font-extrabold text-black">{cartCount}</span>}
          </div>
        )}
      </nav>

      <main>
        {currentView === 'home' && <HomeView />}
        {currentView === 'product-detail' && <ProductDetailView />}
        {currentView === 'cart' && <CartView />}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      <div className="fixed bottom-0 max-w-md w-full px-12 pb-6 pt-2 z-[110] flex justify-center">
        <div className="flex items-center gap-16 rounded-[2rem] border border-white/10 bg-black/50 px-12 py-3 shadow-2xl backdrop-blur-2xl">
          <button
            onClick={() => { setCurrentView('home'); window.scrollTo({top:0, behavior:'smooth'}); }}
            className={`transition-all ${currentView === 'home' ? 'text-white scale-125' : 'text-neutral-500 hover:text-white'}`}
          >
            <Search size={22} strokeWidth={currentView === 'home' ? 3 : 2} />
          </button>
          <button
            onClick={() => setCurrentView('cart')}
            className={`relative transition-all ${currentView === 'cart' ? 'text-white scale-125' : 'text-neutral-500 hover:text-white'}`}
          >
            <ShoppingBag size={22} strokeWidth={currentView === 'cart' ? 3 : 2} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-extrabold text-black">{cartCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
