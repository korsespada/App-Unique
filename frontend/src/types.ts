// Telegram WebApp types
export type TelegramType = {
  WebApp: WebApp;
};

export type WebApp = {
  initData: string;
  initDataUnsafe: WebAppInitData;
  colorScheme: "light" | "dark";
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  MainButton: MainButton;
  ready(): void;
  expand(): void;
  close(): void;
};

export type ThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
};

export type MainButton = {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  onClick: () => void;
  offClick: () => void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  setText(text: string): void;
  setParams(params: { color?: string; text_color?: string }): void;
};

export type WebAppInitData = {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: WebAppChat;
  start_param?: string;
  auth_date: string;
  hash: string;
};

export type WebAppUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type WebAppChat = {
  id: number;
  type: string;
  title: string;
  username?: string;
  photo_url?: string;
};

// App types
export type Category = string;

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  hasPrice?: boolean;
  images: string[];
  thumb?: string;
  description: string;
  details: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number | null;
  hasPrice: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  created: string;
  status: string;
  total_price: number;
  items: OrderItem[];
}

export type AppView = "home" | "product-detail" | "cart" | "favorites" | "profile" | "orders";

export type SortOption = "newest" | "price-asc" | "price-desc" | "brand-az";
