
import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, X, ArrowLeft, Plus, Minus, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  
  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const filteredAndSortedProducts = useMemo(() => {
    let result = PRODUCTS.filter(p => {
      const matchesCategory = activeCategory === 'Все' || p.category === activeCategory;
      const matchesBrand = activeBrand === 'Все' || p.brand === activeBrand;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesBrand && matchesSearch;
    });

    switch (sortOption) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'brand-az':
        result.sort((a, b) => a.brand.localeCompare(b.brand));
        break;
      default:
        break;
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

  // Views
  const HomeView = () => (
    <div className="pb-32 animate-in fade-in duration-500">
      {/* Search Header */}
      <div className="px-6 pt-24 mb-6">
        <div className="relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" />
          <input 
            type="text" 
            placeholder="Поиск по коллекции..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-none py-4 pl-12 pr-4 text-sm rounded-2xl focus:ring-1 focus:ring-black outline-none transition-all"
          />
        </div>
      </div>

      {/* Categories Filter */}
      <div className="px-6 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-6 border-b border-gray-50">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`pb-3 text-[11px] uppercase tracking-[0.2em] transition-all font-bold ${activeCategory === cat ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Brand Select & Sort Bar */}
      <div className="px-6 mb-8 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <select 
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-100 py-3 pl-4 pr-10 text-[11px] uppercase tracking-widest rounded-xl focus:ring-1 focus:ring-black outline-none transition-all text-gray-600 font-extrabold"
          >
            <option value="Все">Бренд</option>
            {BRANDS.filter(b => b !== 'Все').map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        
        <button 
          onClick={() => setIsSortOpen(true)}
          className="p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <ArrowUpDown size={16} />
        </button>
      </div>

      {/* Grid */}
      <div className="px-6 grid grid-cols-2 gap-x-6 gap-y-12">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map(product => (
            <div key={product.id} className="cursor-pointer" onClick={() => navigateToProduct(product)}>
              <div className="aspect-[3/4] overflow-hidden mb-4 bg-gray-50 rounded-3xl relative">
                <img 
                  src={product.images[0]} 
                  alt={product.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-extrabold">{product.brand}</p>
                <h3 className="text-[13px] font-bold tracking-tight truncate leading-tight">{product.name}</h3>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-32 text-center">
            <p className="text-gray-300 italic text-sm">Ничего не найдено</p>
          </div>
        )}
      </div>

      {/* Sort Overlay */}
      {isSortOpen && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSortOpen(false)} />
          <div className="relative w-full bg-white rounded-t-[40px] p-10 animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1 bg-gray-100 rounded-full mx-auto mb-8" />
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-2xl font-extrabold">Сортировка</h4>
              <button onClick={() => setIsSortOpen(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-8">
              {[
                { label: 'По названию бренда (А-Я)', id: 'brand-az' },
                { label: 'Сначала новые', id: 'newest' },
                { label: 'Цена: по возрастанию', id: 'price-asc' },
                { label: 'Цена: по убыванию', id: 'price-desc' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => { setSortOption(opt.id as SortOption); setIsSortOpen(false); }}
                  className={`w-full text-left flex justify-between items-center group ${sortOption === opt.id ? 'text-black font-extrabold' : 'text-gray-400'}`}
                >
                  <span className="text-sm uppercase tracking-widest group-hover:text-black transition-colors font-bold">{opt.label}</span>
                  {sortOption === opt.id && <div className="w-2 h-2 bg-black rounded-full" />}
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
      <div className="pt-20 pb-48 animate-in slide-in-from-right duration-500">
        <div className="px-6 mb-4 flex items-center justify-between">
            <button onClick={() => setCurrentView('home')} className="py-2 flex items-center gap-2 text-gray-400 hover:text-black transition-colors">
            <ArrowLeft size={18} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold">Каталог</span>
            </button>
        </div>
        
        {/* Image Gallery */}
        <div className="relative w-full aspect-[4/5] bg-gray-50 group">
          <img 
            src={selectedProduct.images[currentImageIndex]} 
            alt={`${selectedProduct.name} ${currentImageIndex + 1}`} 
            className="w-full h-full object-cover transition-opacity duration-500"
          />
          
          {selectedProduct.images.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg transition-opacity"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1))}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg transition-opacity"
              >
                <ChevronRight size={20} />
              </button>
              
              {/* Dots indicator */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {selectedProduct.images.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 transition-all duration-300 rounded-full ${i === currentImageIndex ? 'w-6 bg-black' : 'w-2 bg-black/20'}`} 
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails */}
        <div className="px-6 flex gap-3 mt-4 overflow-x-auto scrollbar-hide">
            {selectedProduct.images.map((img, i) => (
                <button 
                    key={i} 
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${i === currentImageIndex ? 'border-black' : 'border-transparent opacity-60'}`}
                >
                    <img src={img} className="w-full h-full object-cover" />
                </button>
            ))}
        </div>

        <div className="px-6 py-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-extrabold mb-2">{selectedProduct.brand}</p>
              <h2 className="text-3xl font-extrabold tracking-tight">{selectedProduct.name}</h2>
            </div>
            <div className="text-right">
                <p className="text-2xl font-extrabold tracking-tighter">{selectedProduct.price.toLocaleString()} ₽</p>
            </div>
          </div>
          
          <div className="h-px bg-gray-50 mb-8" />
          
          <p className="text-sm text-gray-600 leading-[1.8] mb-10 font-normal text-justify">
            {selectedProduct.description}
          </p>

          <div className="space-y-6 mb-12">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-black">Спецификации</h4>
            <div className="grid grid-cols-1 gap-4">
                {selectedProduct.details.map((detail, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                    <div className="w-1.5 h-1.5 bg-black rounded-full" />
                    <span className="text-[12px] font-bold text-neutral-800">{detail}</span>
                </div>
                ))}
            </div>
          </div>

          {/* Sticky Bottom Action */}
          <div className="fixed bottom-[56px] left-0 right-0 max-w-md mx-auto px-6 pb-6 pt-4 bg-white/80 backdrop-blur-xl z-[85]">
            <button 
              onClick={() => {
                addToCart(selectedProduct);
                setCurrentView('cart');
              }}
              className="w-full py-5 bg-black text-white text-[12px] uppercase tracking-[0.3em] font-black rounded-[20px] hover:bg-neutral-800 transition-all active:scale-95 shadow-2xl shadow-black/20"
            >
              Добавить в корзину
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CartView = () => (
    <div className="pt-24 pb-32 px-6 min-h-screen animate-in fade-in duration-500">
      <h2 className="text-4xl font-extrabold mb-10">Корзина</h2>
      
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-8">
            <ShoppingBag size={32} className="text-gray-200" />
          </div>
          <p className="text-gray-400 mb-10 italic font-medium">Ваш список желаний пока пуст.</p>
          <button 
            onClick={() => setCurrentView('home')}
            className="px-12 py-4 bg-black text-white text-[10px] uppercase tracking-[0.3em] font-black rounded-2xl"
          >
            К покупкам
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-6 mb-12">
            {cart.map(item => (
              <div key={item.id} className="flex gap-6 p-5 bg-white border border-gray-50 rounded-[30px] shadow-sm">
                <div className="w-24 h-32 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden">
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-extrabold mb-1">{item.brand}</p>
                      <h4 className="text-[14px] font-extrabold tracking-tight leading-tight">{item.name}</h4>
                    </div>
                    <button onClick={() => updateQuantity(item.id, -item.quantity)} className="text-gray-200 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center bg-gray-50 rounded-xl px-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-2 text-gray-400 hover:text-black">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-2 text-gray-400 hover:text-black">
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-black tracking-tighter">{(item.price * item.quantity).toLocaleString()} ₽</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 bg-black text-white rounded-[40px] shadow-2xl shadow-black/20">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400 text-[11px] uppercase tracking-[0.3em] font-extrabold">Итого к оплате</span>
              <span className="text-3xl font-extrabold tracking-tight">{cartTotal.toLocaleString()} ₽</span>
            </div>
            <p className="text-[10px] text-gray-500 mb-10 uppercase tracking-widest font-black">Экспресс-доставка из Европы</p>
            <button className="w-full py-5 bg-white text-black text-[12px] uppercase tracking-[0.3em] font-black rounded-2xl active:scale-95 transition-transform">
              Оформить заказ
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative overflow-x-hidden shadow-2xl">
      {/* Navbar */}
      <nav className="fixed top-0 max-w-md w-full bg-white/95 backdrop-blur-xl z-[60] flex items-center justify-center px-6 py-6 border-b border-gray-50/50">
        <div 
          onClick={() => { setCurrentView('home'); setActiveCategory('Все'); setActiveBrand('Все'); setSearchQuery(''); }} 
          className="text-2xl tracking-[0.4em] cursor-pointer hover:opacity-50 transition-all font-black"
        >
          YEEZYUNIQUE
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="min-h-screen">
        {currentView === 'home' && <HomeView />}
        {currentView === 'product-detail' && <ProductDetailView />}
        {currentView === 'cart' && <CartView />}
      </main>

      {/* Compact Bottom Navigation */}
      <div className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 px-12 py-2 flex justify-around items-center z-[90] rounded-t-[20px] shadow-2xl">
        <button 
          onClick={() => { setCurrentView('home'); window.scrollTo({top:0, behavior:'smooth'}); }} 
          className={`flex flex-col items-center gap-0.5 transition-all group ${currentView === 'home' ? 'text-black' : 'text-gray-300'}`}
        >
          <Search size={18} strokeWidth={currentView === 'home' ? 3 : 2} className="transition-transform" />
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Каталог</span>
        </button>
        <button 
          onClick={() => setCurrentView('cart')} 
          className={`flex flex-col items-center gap-0.5 relative transition-all group ${currentView === 'cart' ? 'text-black' : 'text-gray-300'}`}
        >
          <ShoppingBag size={18} strokeWidth={currentView === 'cart' ? 3 : 2} className="transition-transform" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-black text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white font-black animate-in zoom-in">
              {cartCount}
            </span>
          )}
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Корзина</span>
        </button>
      </div>
    </div>
  );
};

export default App;
