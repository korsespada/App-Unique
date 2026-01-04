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
    const looksLikeId = rawSearch.length >= 12;
    rawSearch.length <= 120
      && !rawSearch.includes(" ")
      && !rawSearch.includes("\t")
      && !rawSearch.includes("\n");
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
    ({ pageParam = 1 }) => fetchExternalProductsPage(Number(pageParam), {
        search,
        brand,
        category,
        seed
      }),
    {
      getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 2 * 60 * 1000, // 2 минуты
      cacheTime: 5 * 60 * 1000 // 5 минут
    }
  );
}

export type { ExternalProduct };
