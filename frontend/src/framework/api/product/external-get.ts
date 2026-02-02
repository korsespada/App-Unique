import { ExternalProduct, ExternalProductsResponse } from "@framework/types";
import { useInfiniteQuery } from "@tanstack/react-query";

import Api from "../utils/api-config";

export type ExternalProductsPagedResponse = ExternalProductsResponse & {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
};

export type ExternalProductsQuery = {
  search?: string;
  brand?: string;
  category?: string;
  seed?: string;
};

async function fetchExternalProductsPage(
  page: number,
  query?: ExternalProductsQuery
): Promise<ExternalProductsPagedResponse> {
  try {
    const rawSearch = String(query?.search || "")
      .replace(/\s+/g, " ")
      .trim();
    const looksLikeId = /^[a-z0-9]{15}$/i.test(rawSearch);
    const productId = looksLikeId ? rawSearch : undefined;
    const search = looksLikeId ? undefined : rawSearch;
    const brand = String(query?.brand || "").trim();
    const category = String(query?.category || "").trim();
    const seed = String(query?.seed || "").trim();

    const { data } = await Api.get<ExternalProductsPagedResponse>(
      "/external-products",
      {
        params: {
          page,
          perPage: 40,
          ...(seed ? { seed } : {}),
          ...(search ? { search } : {}),
          ...(productId ? { productId } : {}),
          ...(brand ? { brand } : {}),
          ...(category ? { category } : {})
        }
      }
    );

    // Кэшируем ПЕРВУЮ страницу БЕЗ ФИЛЬТРОВ для мгновенного старта
    if (page === 1 && !search && !productId && !brand && !category) {
      try {
        localStorage.setItem("home_products_first_page", JSON.stringify(data));
      } catch (e) {
        // ignore
      }
    }

    return data;
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: { error?: unknown; message?: unknown } };
      message?: unknown;
    };

    const serverError = err?.response?.data?.error;
    const serverMessage = err?.response?.data?.message;

    let msg = "Network error";
    if (typeof serverError === "string" && serverError) {
      msg = serverError;
    } else if (typeof serverMessage === "string" && serverMessage) {
      msg = serverMessage;
    } else if (typeof err?.message === "string" && err.message) {
      msg = err.message;
    }

    throw new Error(msg);
  }
}

export function useGetExternalProducts(query?: ExternalProductsQuery) {
  const rawSearch = String(query?.search || "")
    .replace(/\s+/g, " ")
    .trim();
  const search = rawSearch;
  const brand = String(query?.brand || "").trim();
  const category = String(query?.category || "").trim();
  const seed = String(query?.seed || "").trim();

  function getNextPageParam(lastPage: ExternalProductsPagedResponse) {
    return lastPage.hasNextPage ? lastPage.page + 1 : undefined;
  }

  function fetcher({ pageParam = 1 }: { pageParam?: number }) {
    return fetchExternalProductsPage(Number(pageParam), {
      search,
      brand,
      category,
      seed
    });
  }

  return useInfiniteQuery<ExternalProductsPagedResponse, Error>(
    [
      "external-products",
      {
        search,
        brand,
        category,
        seed
      }
    ],
    fetcher,
    {
      getNextPageParam,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      keepPreviousData: true,
      // Использование закэшированных данных для мгновенного отображения хода
      initialData: () => {
        if (!search && !brand && !category) {
          try {
            const cached = localStorage.getItem("home_products_first_page");
            if (cached) {
              const parsed = JSON.parse(cached);
              return {
                pages: [parsed],
                pageParams: [1]
              };
            }
          } catch {
            return undefined;
          }
        }
        return undefined;
      }
    }
  );
}

export type { ExternalProduct };
