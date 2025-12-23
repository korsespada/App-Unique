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

async function fetchExternalProductsPage(
  page: number
): Promise<ExternalProductsPagedResponse> {
  try {
    const { data } = await Api.get<ExternalProductsPagedResponse>(
      "/external-products",
      {
        params: { page, perPage: 40 }
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

export function useGetExternalProducts() {
  return useInfiniteQuery<ExternalProductsPagedResponse, Error>(
    ["external-products"],
    ({ pageParam = 1 }) => fetchExternalProductsPage(Number(pageParam)),
    {
      getNextPageParam: (lastPage) =>
        lastPage.hasNextPage ? lastPage.page + 1 : undefined,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false
    }
  );
}

export type { ExternalProduct };
