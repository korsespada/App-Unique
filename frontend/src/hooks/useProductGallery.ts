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
  const prefetchedUrlsRef = useRef<Set<string>>(new Set());

  // Reset prefetch cache when product changes
  useEffect(() => {
    if (selectedProduct?.id && selectedProduct.id !== prefetchedProductIdRef.current) {
      prefetchedProductIdRef.current = selectedProduct.id;
      prefetchedUrlsRef.current.clear();
      if (detailLayerASrc) prefetchedUrlsRef.current.add(detailLayerASrc);
      if (detailLayerBSrc) prefetchedUrlsRef.current.add(detailLayerBSrc);
    }
  }, [selectedProduct?.id, detailLayerASrc, detailLayerBSrc]);

  // Handle image crossfade on index change
  useEffect(() => {
    const nextSrc = selectedProduct?.images?.[currentImageIndex] || "";
    if (!selectedProduct || !nextSrc) return;
    const nextResolved = getDetailImageUrl(nextSrc);
    const currentResolved = activeDetailLayer === "A" ? detailLayerASrc : detailLayerBSrc;

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
    prefetchedUrlsRef.current.add(nextResolved);

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
    const images = Array.isArray(selectedProduct.images) ? selectedProduct.images : [];
    if (images.length < 2) return;

    const nextIndex = currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
    const prevIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;

    // Resolve and deduplicate URLs to prefetch
    const urlsToPrefetch = Array.from(new Set([
      getDetailImageUrl(String(images[nextIndex])),
      getDetailImageUrl(String(images[prevIndex]))
    ])).filter(url =>
      url &&
      url !== detailLayerASrc &&
      url !== detailLayerBSrc &&
      !prefetchedUrlsRef.current.has(url)
    );

    if (urlsToPrefetch.length === 0) return;

    let cancelled = false;
    // Add small delay to avoid spamming while swiping fast
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      urlsToPrefetch.forEach(url => {
        if (prefetchedUrlsRef.current.has(url)) return;
        try {
          const img = new Image();
          img.src = url;
          prefetchedUrlsRef.current.add(url);
        } catch { /* ignore */ }
      });
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentImageIndex, selectedProduct, detailLayerASrc, detailLayerBSrc]);

  // Prefetch all images for current product (low priority)
  useEffect(() => {
    if (currentView !== "product-detail") return;
    if (!selectedProduct) return;

    if (prefetchedProductIdRef.current === selectedProduct.id) return;
    prefetchedProductIdRef.current = selectedProduct.id;

    const images = Array.isArray(selectedProduct.images) ? selectedProduct.images : [];
    if (images.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const resolved = images
        .map(src => {
          try {
            return getDetailImageUrl(String(src));
          } catch {
            return "";
          }
        })
        .filter(url =>
          url &&
          url !== detailLayerASrc &&
          url !== detailLayerBSrc &&
          !prefetchedUrlsRef.current.has(url)
        );

      const uniq = Array.from(new Set(resolved));
      const concurrency = 2; // Reduced concurrency
      let idx = 0;

      const pump = () => {
        if (cancelled) return;
        if (idx >= uniq.length) return;

        const batch = uniq.slice(idx, idx + concurrency);
        idx += batch.length;

        batch.forEach(url => {
          if (prefetchedUrlsRef.current.has(url)) return;
          try {
            const img = new Image();
            img.src = url;
            prefetchedUrlsRef.current.add(url);
          } catch { /* ignore */ }
        });

        window.setTimeout(() => pump(), 200); // More delay between batches
      };

      pump();
    }, 1000); // Delayed full prefetch

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentView, selectedProduct, detailLayerASrc, detailLayerBSrc]);
}
