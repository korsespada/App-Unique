import { CartItem, Product } from "../types";

export type CatalogFiltersResponse = {
  categories?: string[];
  brands?: string[];
  subcategories?: string[];
  brandsByCategory?: Record<string, string[]>;
  subcategoriesByCategory?: Record<string, string[]>;
  brandsBySubcategory?: Record<string, string[]>;
  subcategoriesByBrand?: Record<string, string[]>;
};

export type FavoritesById = Record<string, Product>;

export type CartRefItem = CartItem;
