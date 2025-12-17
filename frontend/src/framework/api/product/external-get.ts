import { ExternalProduct, ExternalProductsResponse } from "@framework/types";
import { useQuery } from "@tanstack/react-query";

import Api from "../utils/api-config";

async function fetchExternalProducts(): Promise<ExternalProductsResponse> {
  try {
    const { data } = await Api.get("/external-products", {
      timeout: 30000
    });

    if (!data || typeof data !== "object" || !("products" in data)) {
      throw new Error("Invalid response format");
    }

    return data as ExternalProductsResponse;
  } catch (e: any) {
    const serverError = e?.response?.data?.error;
    const serverMessage = e?.response?.data?.message;
    let message = "Network error";
    if (typeof serverError === "string" && serverError) {
      message = serverError;
    } else if (typeof serverMessage === "string" && serverMessage) {
      message = serverMessage;
    } else if (typeof e?.message === "string" && e.message) {
      message = e.message;
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
