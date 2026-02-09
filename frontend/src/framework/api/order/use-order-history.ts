import { useQuery } from "@tanstack/react-query";

import Api from "../utils/api-config";
import { Order } from "../../../types";

type OrdersResponse = {
    ok: boolean;
    orders: Order[];
};

async function fetchOrders(): Promise<Order[]> {
    try {
        const { data } = await Api.get<OrdersResponse>("/orders");
        return data.orders || [];
    } catch (err) {
        console.error("Failed to fetch orders", err);
        return [];
    }
}

export function useOrderHistory() {
    return useQuery<Order[], Error>(["orders-history"], fetchOrders, {
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 30, // 30 minutes
        refetchOnWindowFocus: false,
        retry: 1
    });
}
