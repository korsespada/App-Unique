import dynamic from "next/dynamic";
import { Suspense } from "react";
import ProductsSkeleton from "@components/skeleton/products";

// Dynamically import the Catalog component with SSR disabled
const Catalog = dynamic(() => import("@containers/catalog"), {
  ssr: false,
  loading: () => <ProductsSkeleton />
});

function LegacyCatalog() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Catalog />
    </Suspense>
  );
}

export default LegacyCatalog;
