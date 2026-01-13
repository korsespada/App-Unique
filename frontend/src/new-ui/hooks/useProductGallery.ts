import { useEffect, useRef } from "react";

import { Product } from "../types";
import { getDetailImageUrl } from "../utils/images";

interface UseProductGalleryOptions {
  currentView: string;
  selectedProduct: Product | null;
  currentImageIndex: number;
  activeDetailLayer: "A" | "B";
  detailLayerASrc: string;
  detailLayerBSrc: string;
  setDetailLayerASrc: (src: string) => void;
  setDetailLayerBSrc: (src: string) => void;
  setActiveDetailLayer: (layer: "A" | "B") => void;
  setIsDetailImageCrossfading: (value: boolean) => void;
}

export function useProductGallery({
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
}: UseProductGalleryOptions) {
  const prefetchedProductIdRef = useRef<string | null>(null);

  // Handle image crossfade on index change
  useEffect(() => {
    const nextSrc = selectedProduct?.images?.[currentImageIndex] || "";
    if (!selectedProduct || !nextSrc) return;
    const nextResolved = getDetailImageUrl(nextSrc);
    const currentResolved =      activeDetailLayer === "A" ? detailLayerASrc : detailLayerBSrc;
    if (nextResolved === currentResolved) return;

    let cancelled = false;
    setIsDetailImageCrossfading(false);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const nextLayer = activeDetailLayer === "A" ? "B" : "A";
      if (nextLayer === "A") setDetailLayerASrc(nextResolved);
      else setDetailLayerBSrc(nextResolved);

      requestAnimationFrame(() => {
        if (cancelled) return;
        setIsDetailImageCrossfading(true);
        setActiveDetailLayer(nextLayer);
      });

      window.setTimeout(() => {
        if (cancelled) return;
        setIsDetailImageCrossfading(false);
      }, 260);
    };
    img.onerror = () => {
      if (cancelled) return;
      const nextLayer = activeDetailLayer === "A" ? "B" : "A";
      if (nextLayer === "A") setDetailLayerASrc(nextResolved);
      else setDetailLayerBSrc(nextResolved);
      setActiveDetailLayer(nextLayer);
      setIsDetailImageCrossfading(false);
    };
    img.src = nextResolved;

    return () => {
      cancelled = true;
    };
  }, [
    activeDetailLayer,
    currentImageIndex,
    detailLayerASrc,
    detailLayerBSrc,
    selectedProduct,
    setActiveDetailLayer,
    setDetailLayerASrc,
    setDetailLayerBSrc,
    setIsDetailImageCrossfading
  ]);

  // Prefetch adjacent images
  useEffect(() => {
    if (!selectedProduct) return;
    const images = Array.isArray(selectedProduct.images)
      ? selectedProduct.images
      : [];
    if (images.length < 2) return;

    const nextIndex =      currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
    const prevIndex =      currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
    const toPrefetch = [images[nextIndex], images[prevIndex]].filter(Boolean);

    toPrefetch.forEach((src) => {
      try {
        const img = new Image();
        img.src = getDetailImageUrl(String(src));
      } catch {
        // ignore
      }
    });
  }, [currentImageIndex, selectedProduct]);

  // Prefetch all images for current product
  useEffect(() => {
    if (currentView !== "product-detail") return;
    if (!selectedProduct) return;

    if (prefetchedProductIdRef.current === selectedProduct.id) return;
    prefetchedProductIdRef.current = selectedProduct.id;

    const images = Array.isArray(selectedProduct.images)
      ? selectedProduct.images
      : [];
    if (images.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const resolved = images
        .map((src) => {
          try {
            return getDetailImageUrl(String(src));
          } catch {
            return "";
          }
        })
        .filter(Boolean);

      const uniq = Array.from(new Set(resolved));
      const concurrency = 3;
      let idx = 0;

      const pump = () => {
        if (cancelled) return;
        if (idx >= uniq.length || idx >= 1000) return;

        const batchStart = idx;
        const batch = uniq.slice(batchStart, batchStart + concurrency);
        idx += batch.length;

        batch.forEach((src) => {
          try {
            const img = new Image();
            img.src = src;
          } catch {
            // ignore
          }
        });

        window.setTimeout(() => pump(), 0);
      };

      pump();
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentView, selectedProduct]);
}
