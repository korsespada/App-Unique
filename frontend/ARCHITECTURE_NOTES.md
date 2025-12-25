# Luxury Brand Replica Store - Architecture Notes

## Current Architecture Overview

### Key Directories

- `/src/pages/` - Contains all page components
  - `/user/` - User-facing pages
    - `/product/` - Product listing and details
      - `list.tsx` - Product listing page
      - `single.tsx` - Single product page
    - `/cart/` - Shopping cart functionality
    - `/checkout/` - Checkout process
    - `/profile/` - User profile and addresses
  - `/admin/` - Admin panel (not relevant for current task)

### Key Components

- `ProductLists` - Displays a grid of products
- `ProductCard` - Individual product card component
- `AppHeader` - Main header component
- `Container` - Layout wrapper component

### State Management

- Uses React Query (`useQuery`, `useMutation`) for data fetching
- Local state for UI components
- Context API for global state (if any)

### API Integration

- API calls are organized in `/src/framework/api/`
- Uses Axios for HTTP requests

## Required Changes for Luxury Brand Replica Store

### 1. Home Page & Product Catalog

- **Current**: Basic home page with hero slider and product news
- **Changes Needed**:
  - Make product listing the main page
  - Add search functionality
  - Add category and brand filters
  - Implement responsive grid layout

**Status (implemented):** основной каталог/главный экран реализован в `src/new-ui/App.tsx`.

### 2. Product Detail Page

- **Current**: Basic product details
- **Changes Needed**:
  - Add image gallery with swiper
  - Add fullscreen image viewer
  - Add "Similar Products" section
  - Sticky add-to-cart button

**Status (implemented):** галерея изображений сделана без `swiper` в `src/new-ui/App.tsx`.

- Double-buffer (A/B) слои для устранения моргания при перелистывании
- Preload следующего кадра + фоновая предзагрузка всех фото после открытия карточки

### 3. Cart & Checkout

- **Current**: Basic cart functionality
- **Changes Needed**:
  - Update quantity in cart
  - Add address form with fields:
    - Full Name
    - Phone
    - City
    - Street/Building/Apartment
    - Comments
  - Save address to user profile
  - Order submission flow

### 4. Telegram Integration

- **Current**: Basic Telegram WebApp integration
- **Changes Needed**:
  - Extract user data helper
  - Pre-fill user data in forms
  - Handle Telegram WebApp events

## File Modification Plan

### 1. Home Page & Product Catalog

- `src/pages/home.tsx` - Update to show product catalog
- `src/components/product/filters/` - New components for filters
- `src/containers/product-grid/` - New container for product grid

### 2. Product Detail Page

- `src/pages/user/product/single.tsx` - Update with new features
- `src/components/product/gallery/` - New image gallery component
- `src/components/product/similar/` - Similar products component

### 3. Cart & Checkout

- `src/pages/user/cart/index.tsx` - Update cart functionality
- `src/pages/user/checkout/index.tsx` - Update checkout form
- `src/components/address/form.tsx` - New address form component

### 4. Telegram Integration

- `src/helpers/telegram.ts` - New helper for Telegram WebApp
- `src/hooks/useTelegramUser.ts` - New hook for user data

## API Endpoints

### Existing Endpoints to Use

- `GET /products` - Get product list
- `GET /products/{id}` - Get product details
- `POST /cart` - Add to cart
- `GET /cart` - Get cart contents
- `POST /orders` - Create order

### New Endpoints Needed

- `GET /profile` - Get user profile with addresses
- `POST /profile` - Update user profile
- `GET /categories` - Get all categories
- `GET /brands` - Get all brands

## Implementation Plan

### Phase 1: Setup & Product Catalog

1. Update home page to show product catalog
2. Add search and filter functionality
3. Implement responsive grid layout

### Phase 2: Product Details

1. Update product detail page with image gallery
2. Add similar products section
3. Implement sticky add-to-cart button

### Phase 3: Cart & Checkout

1. Update cart with quantity controls
2. Create address form
3. Implement order submission

### Phase 4: Telegram Integration

1. Create Telegram user helper
2. Pre-fill user data
3. Handle Telegram events

## Dependencies to Add

- `swiper` - For image galleries (optional; текущая реализация галереи уже есть без swiper)
- `react-hook-form` - For form handling
- `zod` - For form validation
- `@tanstack/react-query` - For data fetching (already in use)

## Backend notes (Vercel)

- `backend/api/index.js` is the Vercel entrypoint.
- `/api/external-products`:
  - Deterministic shuffle by `seed`
  - Round-robin mix by **category**
  - PocketBase snapshot cache (5 min) to reduce TTFB
  - Fallback to last known products snapshot on PocketBase downtime
  - `seedEcho` debug field removed
