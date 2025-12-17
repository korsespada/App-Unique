import { useMemo } from "react";

export type MockBrand = {
  id: string;
  name: string;
  slug: string;
};

export const MOCK_BRANDS: MockBrand[] = [
  { id: "gucci", name: "Gucci", slug: "gucci" },
  { id: "louis-vuitton", name: "Louis Vuitton", slug: "louis-vuitton" },
  { id: "prada", name: "Prada", slug: "prada" },
  { id: "dior", name: "Dior", slug: "dior" }
];

export function useGetBrands(): {
  data: MockBrand[];
  isLoading: false;
  error: null;
} {
  return useMemo(
    () => ({
      data: MOCK_BRANDS,
      isLoading: false,
      error: null
    }),
    []
  );
}

export default useGetBrands;
