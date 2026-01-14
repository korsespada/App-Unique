# Implementation Plan: Product Filter Loading Skeleton

## Overview

This implementation adds visual loading feedback when users filter products by category, brand, or search query. The approach is to create a reusable ProductCardSkeleton component and modify the HomeView rendering logic to display skeletons whenever `isProductsLoading` is true, not just on initial load.

## Tasks

- [x] 1. Create ProductCardSkeleton component
  - Create new file `frontend/src/new-ui/components/ProductCardSkeleton.tsx`
  - Implement skeleton component with matching visual styling (4:5 aspect ratio, rounded corners, bg-white/5)
  - Include placeholder elements for image, brand, and product name
  - Add pulse animation using Tailwind's `animate-pulse` class
  - Support `count` prop to render multiple skeleton cards (default: 8)
  - _Requirements: 1.4, 1.5, 4.1, 4.2, 4.3, 4.4_

- [ ]* 1.1 Write property test for skeleton count
  - **Property 2: Skeleton Count Consistency**
  - **Validates: Requirements 1.4**

- [ ]* 1.2 Write property test for visual styling consistency
  - **Property 4: Visual Styling Consistency**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ]* 1.3 Write unit test for pulse animation presence
  - **Property 3: Pulse Animation Presence**
  - **Validates: Requirements 1.5**

- [x] 2. Update HomeView to use ProductCardSkeleton
  - Import ProductCardSkeleton component in `frontend/src/new-ui/views/HomeView.tsx`
  - Modify product grid rendering logic to show skeletons when `isProductsLoading` is true
  - Remove the condition `sourceProducts.length === 0` from skeleton display logic
  - Ensure skeleton display works for both initial load and filter operations
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [ ]* 2.1 Write property test for skeleton display during filter operations
  - **Property 1: Skeleton Display During Filter Operations**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ]* 2.2 Write property test for loading to loaded transition
  - **Property 5: Loading to Loaded Transition**
  - **Validates: Requirements 2.2**

- [ ]* 2.3 Write unit test for initial load skeleton display
  - Test that skeletons appear on initial load with no products
  - _Requirements: 2.1_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 4. Add integration test for rapid filter changes
  - **Property 6: Rapid Filter Change Handling**
  - **Validates: Requirements 3.3**

- [ ] 5. Final checkpoint - Manual testing
  - Test category filter changes show skeletons
  - Test brand filter changes show skeletons
  - Test search query shows skeletons
  - Test on slow network (throttle to 3G) to verify extended skeleton display
  - Verify no layout shifts or flickering during transitions
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation is minimal and focused on core functionality
- Existing skeleton logic for initial load is preserved and enhanced
- React Query handles request cancellation automatically for rapid filter changes
