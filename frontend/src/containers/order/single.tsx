import Container from "@components/container";
import { useGetOrderById } from "@framework/api/orders/getById";
// eslint-disable-next-line object-curly-newline
import { Tabs } from "antd";
import { useParams } from "react-router";

import CustomerDetail from "./components/customer-detail";
import OrderList from "./components/order-list";
import OrderSetting from "./components/order-setting";

interface Props {
  type: "admin" | "user";
}

function OrdersSingle({ type }: Props) {
  const { order_id } = useParams();
  const { data, isLoading } = useGetOrderById({ order_Id: order_id });
  const order = data?.order;
  const items = [
    {
      label: "Состав заказа",
      key: "1",
      children: <OrderList orders={order} loading={isLoading} />
    },
    {
      label: "Детали",
      key: "3",
      children: <CustomerDetail orders={order} />
    },
    {
      label: "Настройки",
      key: "2",
      children: <OrderSetting orders={order} />
    }
  ];
  return (
    <Container title="Заказ" backwardUrl={-1}>
      <Tabs items={type === "user" ? items.splice(0, 2) : items} />
    </Container>
  );
}

export default OrdersSingle;
