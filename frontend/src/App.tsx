import Api from "@framework/api/utils/api-config";
import React, { useCallback, useEffect, useMemo } from "react";

import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import { useCart } from "./hooks/useCart";
import { useCatalogFilters } from "./hooks/useCatalogFilters";
import { useFavorites } from "./hooks/useFavorites";
import { useNavigation } from "./hooks/useNavigation";
import { useOrders } from "./hooks/useOrders";
import { useProductGallery } from "./hooks/useProductGallery";
import {
  useInfiniteScroll,
  useProducts,
  useSyncCartWithProducts,
  useSyncFavoritesWithProducts
} from "./hooks/useProducts";
import { useProfileSync } from "./hooks/useProfileSync";
import { useScrolled } from "./hooks/useScrolled";
import { Product } from "./types";
import { getDetailImageUrl, getThumbUrl } from "./utils/images";
import CartView from "./views/CartView";
import FavoritesView from "./views/FavoritesView";
import HomeView from "./views/HomeView";
import OrdersHistoryView from "./views/OrdersHistoryView";
import ProductDetailView from "./views/ProductDetailView";
import ProfileView from "./views/ProfileView";

const App: React.FC = () => {
  const {
    activeBrand,
    setActiveBrand,
    activeCategory,
    setActiveCategory,
    activeSubcategory,
    setActiveSubcategory,
    searchQuery,
    setSearchQuery,
    derivedCategories,
    derivedBrands,
    derivedSubcategories,
    resetFilters,
    setSourceProducts
  } = useCatalogFilters();

  const {
    products: sourceProducts,
    productsRef,
    totalItems,
    isProductsLoading,
    loadMoreRef,
    loadMoreEl,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useProducts({
    searchQuery,
    activeBrand,
    activeCategory,
    activeSubcategory
  });

  useEffect(() => {
    setSourceProducts(sourceProducts);
  }, [setSourceProducts, sourceProducts]);

  const {
    cart,
    setCart,
    cartRef,
    addToCart,
    updateQuantity,
    clearCart,
    buildMergedCart,
    cartHasUnknownPrice,
    cartTotal,
    cartTotalText,
    cartCount
  } = useCart();

  const {
    currentView,
    setCurrentView,
    selectedProduct,
    setSelectedProduct,
    pendingOpenProductId,
    setPendingOpenProductId,
    currentImageIndex,
    setCurrentImageIndex,
    touchStartXRef,
    touchLastXRef,
    detailLayerASrc,
    setDetailLayerASrc,
    detailLayerBSrc,
    setDetailLayerBSrc,
    activeDetailLayer,
    setActiveDetailLayer,
    isDetailImageCrossfading,
    setIsDetailImageCrossfading,
    shouldRestoreHomeScrollRef,
    saveHomeScroll,
    restoreHomeScroll,
    navigateToProduct
  } = useNavigation({ productsRef, cartRef });

  const {
    favorites,
    setFavorites,
    favoriteItemsById,
    setFavoriteItemsById,
    favoriteBumpId,
    toggleFavorite,
    buildMergedFavorites
  } = useFavorites(productsRef);

  useProfileSync({
    cart,
    favorites,
    setCart,
    setFavorites,
    buildMergedCart,
    buildMergedFavorites,
    cartRef
  });

  useSyncCartWithProducts(sourceProducts, setCart);
  useSyncFavoritesWithProducts(favorites, sourceProducts, setFavoriteItemsById);

  useInfiniteScroll(
    currentView,
    loadMoreEl,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  );

  useProductGallery({
    currentView,
    selectedProduct,
    currentImageIndex,
    activeDetailLayer,
    detailLayerASrc,
    detailLayerBSrc,
    setDetailLayerASrc,
    setDetailLayerBSrc,
    setActiveDetailLayer,
    setIsDetailImageCrossfading
  });

  const { isSendingOrder, orderComment, setOrderComment, sendOrderToManager } =
    useOrders({
      cart,
      cartTotal,
      cartHasUnknownPrice,
      clearCart,
      setCurrentView
    });

  const scrolled = useScrolled();

  const filteredAndSortedProducts = useMemo(
    () => sourceProducts,
    [sourceProducts]
  );

  useEffect(() => {
    if (!pendingOpenProductId) return;
    setSearchQuery("");
    setActiveCategory("Все");
    setActiveBrand("Все");
  }, [pendingOpenProductId, setActiveBrand, setActiveCategory, setSearchQuery]);

  useEffect(() => {
    if (!pendingOpenProductId) return;
    if (currentView !== "home") return;

    const p = sourceProducts.find(
      (x) => String(x.id).trim() === String(pendingOpenProductId).trim()
    );
    if (!p) return;

    setSelectedProduct(p);
    setCurrentView("product-detail");
    setPendingOpenProductId("");
  }, [
    pendingOpenProductId,
    currentView,
    sourceProducts,
    setCurrentView,
    setPendingOpenProductId,
    setSelectedProduct
  ]);

  useEffect(() => {
    const raw = String(searchQuery || "").trim();
    const looksLikeId = /^[a-z0-9]{15}$/i.test(raw);
    if (!looksLikeId) return;

    setActiveCategory("Все");
    setActiveBrand("Все");
    setPendingOpenProductId(raw);
  }, [searchQuery, setActiveBrand, setActiveCategory, setPendingOpenProductId]);

  useEffect(() => {
    if (currentView !== "cart") return undefined;
    if (cart.length !== 0) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cart.length, currentView]);

  const copyProductLink = useCallback(() => {
    const id = selectedProduct?.id || "";
    if (!id) return;
    const productUrl = `https://t.me/YeezyUniqueBot?startapp=product__${id}`;

    navigator.clipboard
      .writeText(productUrl)
      .then(() => {
        alert("Ссылка скопирована!");
      })
      .catch(() => {
        alert("Не удалось скопировать ссылку");
      });
  }, [selectedProduct]);

  useEffect(() => {
    if (currentView !== "product-detail") return;
    const id = String(selectedProduct?.id || "").trim();
    if (!id) return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await Api.get(`products/${encodeURIComponent(id)}`);
        if (cancelled) return;

        const rawImages = (data as any)?.images;
        const rawPhotos = (data as any)?.photos;
        const fullImages = Array.isArray(rawImages)
          ? rawImages
          : Array.isArray(rawPhotos)
            ? rawPhotos
              .map((x: any) => String(x?.url || "").trim())
              .filter(Boolean)
            : [];
        const fullImagesUniq = Array.from(new Set(fullImages));

        setSelectedProduct((prev) => {
          if (!prev) return prev;
          if (String(prev.id || "").trim() !== id) return prev;
          return {
            ...prev,
            images: fullImagesUniq,
            description: String(
              (data as any)?.description || prev.description || ""
            ),
            category: String((data as any)?.category || prev.category || "Все"),
            brand: String((data as any)?.brand || prev.brand || " "),
            thumb: String((data as any)?.thumb || prev.thumb || "")
          } as Product;
        });

        setCurrentImageIndex(0);
        const first = String(fullImagesUniq[0] || "");
        const firstResolved = first ? getDetailImageUrl(first) : "";
        setDetailLayerASrc(firstResolved);
        setDetailLayerBSrc("");
        setActiveDetailLayer("A");
        setIsDetailImageCrossfading(false);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentView,
    selectedProduct?.id,
    setActiveDetailLayer,
    setCurrentImageIndex,
    setDetailLayerASrc,
    setDetailLayerBSrc,
    setIsDetailImageCrossfading,
    setSelectedProduct
  ]);

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      {currentView !== "product-detail" &&
        currentView !== "profile" &&
        currentView !== "orders" && (
          <TopNav
            currentView={currentView}
            scrolled={scrolled}
            setCurrentView={setCurrentView}
            restoreHomeScroll={restoreHomeScroll}
            shouldRestoreHomeScrollRef={shouldRestoreHomeScrollRef}
          />
        )}

      <main>
        {currentView === "home" && (
          <HomeView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            derivedCategories={derivedCategories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            derivedBrands={derivedBrands}
            activeBrand={activeBrand}
            setActiveBrand={setActiveBrand}
            derivedSubcategories={derivedSubcategories}
            activeSubcategory={activeSubcategory}
            setActiveSubcategory={setActiveSubcategory}
            resetFilters={resetFilters}
            totalItems={totalItems}
            isProductsLoading={isProductsLoading}
            sourceProducts={sourceProducts}
            filteredAndSortedProducts={filteredAndSortedProducts}
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            toggleFavorite={toggleFavorite}
            loadMoreRef={loadMoreRef}
            isFetchingNextPage={isFetchingNextPage}
          />
        )}
        {currentView === "product-detail" && (
          <ProductDetailView
            selectedProduct={selectedProduct}
            activeDetailLayer={activeDetailLayer}
            detailLayerASrc={detailLayerASrc}
            detailLayerBSrc={detailLayerBSrc}
            isDetailImageCrossfading={isDetailImageCrossfading}
            currentImageIndex={currentImageIndex}
            setCurrentImageIndex={setCurrentImageIndex}
            touchStartXRef={touchStartXRef}
            touchLastXRef={touchLastXRef}
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            cart={cart}
            copyProductLink={copyProductLink}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            toggleFavorite={toggleFavorite}
          />
        )}
        {currentView === "cart" && (
          <CartView
            cart={cart}
            cartTotalText={cartTotalText}
            orderComment={orderComment}
            setOrderComment={setOrderComment}
            sendOrderToManager={sendOrderToManager}
            isSendingOrder={isSendingOrder}
            setCurrentView={setCurrentView}
            restoreHomeScroll={restoreHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            updateQuantity={updateQuantity}
          />
        )}
        {currentView === "favorites" && (
          <FavoritesView
            favorites={favorites}
            favoriteItemsById={favoriteItemsById}
            favoriteBumpId={favoriteBumpId}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
          />
        )}
        {currentView === "profile" && (
          <ProfileView setCurrentView={setCurrentView} />
        )}
        {currentView === "orders" && (
          <OrdersHistoryView setCurrentView={setCurrentView} />
        )}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      {currentView !== "product-detail" && (
        <BottomNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          saveHomeScroll={saveHomeScroll}
          restoreHomeScroll={restoreHomeScroll}
          shouldRestoreHomeScrollRef={shouldRestoreHomeScrollRef}
          cartCount={cartCount}
        />
      )}
    </div>
  );
};

export default App;
