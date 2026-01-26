import { CartItem, Product } from "../types";

export type CatalogFiltersResponse = {
  categories?: string[];
  brands?: string[];
  brandsByCategory?: Record<string, string[]>;
};

export type FavoritesById = Record<string, Product>;

export type CartRefItem = CartItem;
