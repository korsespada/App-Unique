import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import ProductsSkeleton from "@components/skeleton/products";

// Dynamically import the Catalog component with SSR disabled
const Catalog = dynamic(
  () => import('@containers/catalog'),
  {
    ssr: false,
    loading: () => <ProductsSkeleton count={12} />
  }
);

function Home() {
  return (
    <Suspense fallback={<ProductsSkeleton count={12} />}>
      <Catalog />
    </Suspense>
  );
}

export default Home;
