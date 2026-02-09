import { ArrowLeft, Clock, ShoppingBag } from "lucide-react";
import React from "react";

import { useOrderHistory } from "../framework/api/order/use-order-history";
import { AppView, Order } from "../types";

type Props = {
    setCurrentView: (v: AppView) => void;
};

export default function OrdersHistoryView({ setCurrentView }: Props) {
    const { data: orders, isLoading } = useOrderHistory();

    const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <div className="min-h-screen animate-in fade-in bg-black pb-32 pt-6 text-white duration-500">
            <div className="mb-6 flex items-center gap-4 px-4">
                <button
                    onClick={() => setCurrentView("profile")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold">История заказов</h2>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
            ) : !orders || orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/5">
                        <Clock size={32} className="text-white/20" />
                    </div>
                    <p className="text-lg font-semibold text-white/60">
                        История заказов пуста
                    </p>
                    <button
                        onClick={() => setCurrentView("home")}
                        className="mt-8 rounded-xl bg-white px-8 py-3 text-sm font-bold text-black hover:bg-white/90">
                        Перейти в каталог
                    </button>
                </div>
            ) : (
                <div className="space-y-4 px-4">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition-all active:scale-[0.98]">
                            <div className="mb-3 flex items-start justify-between">
                                <div>
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                                            #{order.order_number}
                                        </span>
                                        <span
                                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${order.status === "completed"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : order.status === "cancelled"
                                                        ? "bg-red-500/20 text-red-400"
                                                        : "bg-blue-500/20 text-blue-400"
                                                }`}>
                                            {getStatusText(order.status)}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-white/60">
                                        {dateFormatter.format(new Date(order.created))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold">
                                        {order.total_price > 0
                                            ? `${order.total_price.toLocaleString()} ₽`
                                            : "По запросу"}
                                    </div>
                                    <div className="text-xs text-white/40">
                                        {order.items.length} {getPlural(order.items.length, ["товар", "товара", "товаров"])}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-white/5 pt-3">
                                {order.items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                        <span className="line-clamp-1 flex-1 text-white/80">
                                            {item.title}
                                        </span>
                                        <span className="ml-2 text-white/40">
                                            {item.quantity} шт
                                        </span>
                                    </div>
                                ))}
                                {order.items.length > 3 && (
                                    <div className="text-xs text-white/40">
                                        и еще {order.items.length - 3}...
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getStatusText(status: string) {
    switch (status) {
        case "new":
            return "Новый";
        case "processing":
            return "В обработке";
        case "completed":
            return "Выполнен";
        case "cancelled":
            return "Отменен";
        default:
            return status;
    }
}

function getPlural(n: number, forms: [string, string, string]) {
    let idx;
    if (n % 10 === 1 && n % 100 !== 11) {
        idx = 0;
    } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
        idx = 1;
    } else {
        idx = 2;
    }
    return forms[idx];
}
