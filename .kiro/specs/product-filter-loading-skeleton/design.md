# Design Document: Product Filter Loading Skeleton

## Overview

This feature enhances the user experience by displaying skeleton loading cards when users filter products by category, brand, or search query. The current implementation only shows skeletons during initial load (`isProductsLoading && sourceProducts.length === 0`), but provides no visual feedback when filters are applied and products are already displayed. This creates confusion as users don't know if their filter action was registered or if the system is processing their request.

The solution adds a new loading state specifically for filter operations that displays skeleton cards while maintaining the existing products in memory until new results arrive. This provides immediate visual feedback and a smooth transition between filter states.

## Architecture

### Current State Flow

```
User Action (Filter Change)
  ↓
useCatalogFilters updates state (activeBrand/activeCategory/searchQuery)
  ↓
useProducts receives new filter params
  ↓
React Query invalidates cache and fetches new data
  ↓
isProductsLoading = true (but only shows skeleton if sourceProducts.length === 0)
  ↓
New products arrive
  ↓
Products displayed
```

### Proposed State Flow

```
User Action (Filter Change)
  ↓
useCatalogFilters updates state
  ↓
Track previous filter state to detect changes
  ↓
useProducts receives new filter params
  ↓
React Query invalidates cache and fetches new data
  ↓
Detect: isProductsLoading && sourceProducts.length > 0 && filters changed
  ↓
Display skeleton cards (new behavior)
  ↓
New products arrive
  ↓
Products displayed with smooth transition
```

## Components and Interfaces

### 1. ProductCardSkeleton Component (Reusable)

Create a new skeleton component that matches the HomeView product card design:

```typescript
// frontend/src/new-ui/components/ProductCardSkeleton.tsx

interface ProductCardSkeletonProps {
  count?: number;
}

export function ProductCardSkeleton({ count = 8 }: ProductCardSkeletonProps): JSX.Element
```

**Responsibilities:**
- Render skeleton cards that match the 4:5 aspect ratio of product cards
- Apply pulse animation for loading indication
- Match the visual styling (rounded corners, background opacity)
- Include placeholder elements for image, brand, and product name
- Support rendering multiple skeleton cards via `count` prop

**Visual Structure:**
```
┌─────────────────────┐
│                     │
│   Image Skeleton    │  ← 4:5 aspect ratio, rounded-[1.25rem]
│   (pulse animation) │
│                     │
└─────────────────────┘
  Brand Skeleton       ← Small bar, 4rem width
  Name Skeleton        ← Larger bar, 7rem width
```

### 2. Enhanced HomeView Logic

Modify the product grid rendering logic in `HomeView.tsx`:

**Current Logic:**
```typescript
{isProductsLoading && sourceProducts.length === 0 ? (
  // Show 8 skeletons
) : filteredAndSortedProducts.length > 0 ? (
  // Show products
) : (
  // Show "nothing found"
)}
```

**New Logic:**
```typescript
{isProductsLoading ? (
  // Show skeletons (both initial load AND filter load)
  <ProductCardSkeleton count={8} />
) : filteredAndSortedProducts.length > 0 ? (
  // Show products
) : (
  // Show "nothing found"
)}
```

### 3. Filter Change Detection (Optional Enhancement)

For more sophisticated behavior, we could track filter changes:

```typescript
// In App.tsx or custom hook
const prevFiltersRef = useRef({ 
  category: activeCategory, 
  brand: activeBrand, 
  search: searchQuery 
});

const filtersChanged = 
  prevFiltersRef.current.category !== activeCategory ||
  prevFiltersRef.current.brand !== activeBrand ||
  prevFiltersRef.current.search !== searchQuery;

useEffect(() => {
  prevFiltersRef.current = { 
    category: activeCategory, 
    brand: activeBrand, 
    search: searchQuery 
  };
}, [activeCategory, activeBrand, searchQuery]);
```

However, for the initial implementation, we can rely on the simpler approach of showing skeletons whenever `isProductsLoading` is true, regardless of whether products exist.

## Data Models

No new data models are required. The feature uses existing state:

- `isProductsLoading: boolean` - Already provided by `useProducts` hook
- `sourceProducts: Product[]` - Already tracked in state
- `activeCategory: string` - Already tracked in `useCatalogFilters`
- `activeBrand: string` - Already tracked in `useCatalogFilters`
- `searchQuery: string` - Already tracked in `useCatalogFilters`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Skeleton Display During Filter Operations

*For any* filter change (category, brand, or search query), when the system is loading products (`isProductsLoading` is true), the system should display skeleton cards instead of product cards or empty state.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Skeleton Count Consistency

*For any* skeleton display state, the system should render exactly 8 skeleton cards in a 2-column grid layout.

**Validates: Requirements 1.4**

### Property 3: Pulse Animation Presence

*For any* skeleton card displayed, the element should have the `animate-pulse` CSS class to indicate loading state.

**Validates: Requirements 1.5**

### Property 4: Visual Styling Consistency

*For any* skeleton card, its visual properties should match actual product cards: aspect ratio (aspect-[4/5]), rounded corners (rounded-[1.25rem]), background styling (bg-white/5), and include placeholder elements for brand and product name.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 5: Loading to Loaded Transition

*For any* transition from loading state to loaded state, when `isProductsLoading` changes from true to false and products are available, skeleton cards should be replaced with actual product cards.

**Validates: Requirements 2.2**

### Property 6: Rapid Filter Change Handling

*For any* sequence of rapid filter changes, the system should handle state transitions gracefully without errors, and the final displayed products should match the final filter state.

**Validates: Requirements 3.3**

## Error Handling

### Loading Errors

**Scenario:** API request fails during filter operation

**Handling:**
- React Query will handle retry logic automatically
- If all retries fail, `isProductsLoading` becomes false
- The "nothing found" message will display
- User can reset filters or try again

### Rapid Filter Changes

**Scenario:** User changes filters multiple times quickly

**Handling:**
- React Query automatically cancels previous requests
- Only the latest filter combination is fetched
- Skeleton state remains visible until the final request completes
- No flickering or race conditions due to React Query's built-in request cancellation

### Empty Results

**Scenario:** Filter returns no products

**Handling:**
- `isProductsLoading` becomes false
- `filteredAndSortedProducts.length === 0` triggers "nothing found" message
- User can reset filters via the "Сбросить фильтры" button

## Testing Strategy

### Unit Tests

**Test File:** `frontend/src/new-ui/components/ProductCardSkeleton.test.tsx`

1. **Skeleton Rendering**
   - Test that skeleton renders with default count (8)
   - Test that skeleton renders with custom count
   - Test that skeleton has correct CSS classes for styling

2. **Visual Properties**
   - Test that skeleton has 4:5 aspect ratio class
   - Test that skeleton has rounded-[1.25rem] class
   - Test that skeleton has bg-white/5 class
   - Test that skeleton includes brand and name placeholders

**Test File:** `frontend/src/new-ui/views/HomeView.test.tsx`

3. **Loading State Display**
   - Test that skeletons display when `isProductsLoading` is true
   - Test that products display when `isProductsLoading` is false and products exist
   - Test that "nothing found" displays when `isProductsLoading` is false and no products

4. **Integration with Filters**
   - Test that changing category triggers loading state
   - Test that changing brand triggers loading state
   - Test that entering search query triggers loading state

### Property-Based Tests

**Test File:** `frontend/src/new-ui/components/ProductCardSkeleton.property.test.tsx`

1. **Property Test: Skeleton Count**
   - Generate random counts (1-20)
   - Verify that exactly that many skeleton cards are rendered
   - **Feature: product-filter-loading-skeleton, Property 2: Skeleton Count Consistency**

2. **Property Test: Visual Consistency**
   - Generate random skeleton instances
   - Verify all have consistent styling properties
   - **Feature: product-filter-loading-skeleton, Property 3: Visual Consistency**

### Manual Testing Checklist

1. Open application and verify initial load shows skeletons
2. Select a category and verify skeletons appear during load
3. Select a brand and verify skeletons appear during load
4. Enter search query and verify skeletons appear during load
5. Rapidly change filters and verify no flickering
6. Test on slow network (throttle to 3G) to see extended skeleton display
7. Verify skeleton cards match product card styling

### Testing Framework

- **Unit Tests:** Vitest + React Testing Library
- **Property Tests:** fast-check (JavaScript property-based testing library)
- **Test Configuration:** Minimum 100 iterations per property test
