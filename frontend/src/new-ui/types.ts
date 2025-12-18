
export type Category = string;

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  images: string[];
  description: string;
  details: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export type AppView = 'home' | 'product-detail' | 'cart';

export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'brand-az';
