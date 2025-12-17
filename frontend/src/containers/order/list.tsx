import Container from "@components/container";
import { useGetOrderByUser } from "@framework/api/orders/get-by-user";
import { GetOrderStatus } from "@helpers/get-order-status";
import useTelegramUser from "@hooks/useTelegramUser";
import { addCommas } from "@persian-tools/persian-tools";
import { Table } from "antd";
import { ColumnsType } from "antd/es/table";
import moment from "jalali-moment";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

interface DataType {
  key: string;
  name: string;
  code: string;
  time: string;
  status: string;
  tracking_code: string;
}
interface Props {
  type: "profile" | "user";
}

function OrderList({ type }: Props) {
  const { id } = useTelegramUser();
  const location = useLocation();
  const { data, isLoading, isFetching, refetch } = useGetOrderByUser({
    user_id: id
  });
  useEffect(() => {
    refetch();
  }, [refetch, location]);
  const orders = data?.orders || [];
  const dataChangingStructure: DataType[] =
    orders.map((item) => ({
      key: item.order_Id.toString(),
      code: item.order_Id.toString(),
      name: item.user_Full_Name,
      price: item.total_Price,
      status: item.order_Status,
      time: item.order_Date,
      tracking_code: item.tracking_Code
    })) || [];

  const columns: ColumnsType<DataType> = [
    {
      title: "Номер",
      width: "fit-content",
      dataIndex: "code",
      key: "code",
      render: (text, record) => (
        <Link
          to={`/profile/orders/${record.key}`}
          className="text-blue-[var(--tg-theme-button-color)]">
          {text}#
        </Link>
      )
    },
    {
      title: "Имя",

      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Link
          to={`/profile/orders/${record.key}`}
          className="text-blue-[var(--tg-theme-button-color)]">
          {text}
        </Link>
      )
    },
    {
      title: "Сумма",

      dataIndex: "price",
      key: "price",
      render: (text, record) => (
        <Link
          to={`/profile/orders/${record.key}`}
          className="text-blue-[var(--tg-theme-button-color)]">
          {addCommas(text || 0)}
        </Link>
      )
    },

    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (text) => <p>{GetOrderStatus(text)}</p>
    },
    {
      title: "Дата",
      dataIndex: "time",
      key: "time",
      render: (text) => (
        <p>{moment(text).locale("fa").format("YYYY/MM/DD") || ""}</p>
      )
    }
  ];

  return (
    <Container backwardUrl={-1} title="Список заказов">
      <Table
        columns={columns}
        loading={isLoading || isFetching}
        scroll={{ x: 400 }}
        dataSource={dataChangingStructure}
      />
    </Container>
  );
}

export default OrderList;
