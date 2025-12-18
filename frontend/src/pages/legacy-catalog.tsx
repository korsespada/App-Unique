import dynamic from "next/dynamic";
import { Suspense } from "react";

import ProductsSkeleton from "@components/skeleton/products";

const Catalog = dynamic(
  () => import("@containers/catalog"),
  {
    ssr: false,
    loading: () => <ProductsSkeleton count={12} />
  }
);

function LegacyCatalog() {
  return (
    <Suspense fallback={<ProductsSkeleton count={12} />}>
      <Catalog />
    </Suspense>
  );
}

export default LegacyCatalog;


