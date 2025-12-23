import { ExternalProduct, ExternalProductsResponse } from "@framework/types";
import { useQuery } from "@tanstack/react-query";

import Api from "../utils/api-config";

async function fetchExternalProducts(): Promise<ExternalProductsResponse> {
  try {
    const { data } = await Api.get<ExternalProductsResponse>("/external-products");
    return data;
  } catch (e: unknown) {
    const err: any = e as any;
    const serverError = err?.response?.data?.error;
    const serverMessage = err?.response?.data?.message;
    let message = "Network error";
    if (typeof serverError === "string" && serverError) {
      message = serverError;
    } else if (typeof serverMessage === "string" && serverMessage) {
      message = serverMessage;
    } else if (typeof err?.message === "string" && err.message) {
      message = err.message;
    }

    throw new Error(message);
  }
}

export const useGetExternalProducts = () =>
  useQuery<ExternalProductsResponse, Error>(
    ["external-products"],
    fetchExternalProducts,
    {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false
    }
  );

export type { ExternalProduct };
