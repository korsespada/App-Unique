import React from "react";

interface ProductCardSkeletonProps {
  count?: number;
}

export function ProductCardSkeleton({
  count = 8
}: ProductCardSkeletonProps): React.ReactElement {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`skeleton-${idx}`} className="animate-pulse">
          <div className="mb-5 aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-white/5" />
          <div className="px-2">
            <div className="mb-2 h-3 w-16 rounded bg-white/10" />
            <div className="h-4 w-28 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </>
  );
}

ProductCardSkeleton.defaultProps = {
  count: 8
};
