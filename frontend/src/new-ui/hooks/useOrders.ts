import Api from "@framework/api/utils/api-config";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState
} from "react";

import { AppView, CartItem } from "../types";
import { trackEvent } from "../utils/analytics";

interface UseOrdersOptions {
  cart: CartItem[];
  cartTotal: number;
  cartHasUnknownPrice: boolean;
  clearCart: () => void;
  setCurrentView: Dispatch<SetStateAction<AppView>>;
}

export function useOrders({
  cart,
  cartTotal,
  cartHasUnknownPrice,
  clearCart,
  setCurrentView
}: UseOrdersOptions) {
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [orderComment, setOrderComment] = useState<string>("");

  const sendOrderToManager = useCallback(async () => {
    if (isSendingOrder) return;
    if (!cart.length) return;

    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const initData = tg?.initData;

    if (!user?.id || !initData) {
      alert(
        "Откройте мини‑приложение внутри Telegram, чтобы отправить заказ менеджеру."
      );
      return;
    }

    const payload = {
      initData,
      comment: orderComment,
      items: cart.map((it) => ({
        id: it.id,
        title: it.name,
        quantity: it.quantity,
        hasPrice: it.hasPrice !== false,
        price: it.hasPrice !== false ? it.price : null,
        image: it.images?.[0] || ""
      }))
    };

    try {
      setIsSendingOrder(true);
      const { data } = await Api.post("/orders", payload, { timeout: 30000 });

      const orderId = (data as any)?.orderId;
      trackEvent("order_success", {
        order_id: orderId ? String(orderId) : undefined,
        items_count: cart.length,
        total: cartTotal,
        has_unknown_price: cartHasUnknownPrice
      });

      alert("Заказ отправлен менеджеру");
      clearCart();
      setOrderComment("");
      setCurrentView("home");
    } catch (e: any) {
      const msg = e?.response?.data?.error;
      e?.message || "Не удалось отправить заказ менеджеру";
      alert(String(msg));
    } finally {
      setIsSendingOrder(false);
    }
  }, [
    isSendingOrder,
    cart,
    orderComment,
    cartTotal,
    cartHasUnknownPrice,
    clearCart,
    setCurrentView
  ]);

  return {
    isSendingOrder,
    orderComment,
    setOrderComment,
    sendOrderToManager
  };
}
