import {
 useCallback, useEffect, useRef, useState 
} from "react";

import { AppView, Product } from "../types";
import { getDetailImageUrl } from "../utils/images";
import { useHomeScroll } from "./useHomeScroll";

interface UseNavigationOptions {
  productsRef: React.MutableRefObject<Product[]>;
  cartRef: React.MutableRefObject<any[]>;
}

export function useNavigation({ productsRef, cartRef }: UseNavigationOptions) {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pendingOpenProductId, setPendingOpenProductId] = useState<string>("");

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const [detailLayerASrc, setDetailLayerASrc] = useState<string>("");
  const [detailLayerBSrc, setDetailLayerBSrc] = useState<string>("");
  const [activeDetailLayer, setActiveDetailLayer] = useState<"A" | "B">("A");
  const [isDetailImageCrossfading, setIsDetailImageCrossfading] =    useState(false);

  const isHistoryFirstRef = useRef(true);
  const isPopNavRef = useRef(false);
  const lastPushedViewRef = useRef<AppView>("home");

  const { shouldRestoreHomeScrollRef, saveHomeScroll, restoreHomeScroll } =
    useHomeScroll(currentView);

  // Handle Telegram start_param
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = String(tg?.initDataUnsafe?.start_param || "").trim();
    if (!startParam) return;

    const id = startParam.startsWith("product__")
      ? startParam.slice("product__".length).trim()
      : startParam.startsWith("product_")
      ? startParam.slice("product_".length).trim()
      : "";

    if (!id) return;
    setPendingOpenProductId(id);
  }, []);

  // Telegram BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp as any;
    const backButton = tg?.BackButton;
    if (!backButton) return undefined;

    const handler = () => window.history.back();

    try {
      backButton.onClick?.(handler);
    } catch {
      // ignore
    }

    return () => {
      try {
        backButton.offClick?.(handler);
      } catch {
        // ignore
      }
    };
  }, []);

  // Show/hide BackButton based on view
  useEffect(() => {
    const tg = window.Telegram?.WebApp as any;
    const backButton = tg?.BackButton;
    if (!backButton) return;
    if (currentView === "home") backButton.hide();
    else backButton.show();
  }, [currentView]);

  // Browser history handling
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = (e.state || {}) as any;
      const view = state?.view as AppView | undefined;

      isPopNavRef.current = true;

      if (!view) {
        setSelectedProduct(null);
        setCurrentView("home");
        shouldRestoreHomeScrollRef.current = true;
        return;
      }

      if (view === "product-detail") {
        const productId = String(state?.productId || "").trim();
        const fromProducts = productsRef.current.find(
          (p) => p.id === productId
        );
        const fromCart = cartRef.current.find((p) => p.id === productId);
        const product = fromProducts || fromCart;
        if (product) {
          setSelectedProduct(product);
          setCurrentImageIndex(0);
          setCurrentView("product-detail");
        } else {
          setSelectedProduct(null);
          setCurrentView("home");
        }
        return;
      }

      setSelectedProduct(null);
      setCurrentView(view);

      if (view === "home") {
        shouldRestoreHomeScrollRef.current = true;
      }
    };

    window.history.replaceState({ view: "home" }, "");
    isHistoryFirstRef.current = false;

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [productsRef, cartRef, shouldRestoreHomeScrollRef]);

  // Push state on view change
  useEffect(() => {
    if (isPopNavRef.current) {
      isPopNavRef.current = false;
      return;
    }

    const fromView = lastPushedViewRef.current;
    const state =
      currentView === "product-detail"
      ? { view: currentView, productId: selectedProduct?.id || "", fromView }
      : { view: currentView, fromView };

    window.history.pushState(state, "");
    lastPushedViewRef.current = currentView;

    window.dispatchEvent(
      new CustomEvent("telegram-view-change", {
        detail: {
          view: currentView,
          productId:
            currentView === "product-detail" ? selectedProduct?.id : undefined
        }
      })
    );
  }, [currentView, selectedProduct?.id]);

  const navigateToProduct = useCallback(
    (product: Product) => {
      if (currentView === "home") saveHomeScroll();
      setSelectedProduct(product);
      setCurrentImageIndex(0);
      const first = product?.images?.[0] || "";
      const firstResolved = first ? getDetailImageUrl(first) : "";
      setDetailLayerASrc(firstResolved);
      setDetailLayerBSrc("");
      setActiveDetailLayer("A");
      setIsDetailImageCrossfading(false);
      setCurrentView("product-detail");
      window.scrollTo(0, 0);
    },
    [currentView, saveHomeScroll]
  );

  return {
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
  };
}
