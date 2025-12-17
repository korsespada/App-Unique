/* eslint-disable camelcase */
import useUpdateOrder from "@framework/api/orders/update";
import { Order } from "@framework/types";
import useTelegramUser from "@hooks/useTelegramUser";
import { Button, Divider, Input, message, Radio } from "antd";
import { useState } from "react";

interface Props {
  orders: Order | undefined;
}

function OrderSetting({ orders }: Props) {
  const mutation = useUpdateOrder({ order_id: orders?.order_Id });
  const [status, setStatus] = useState(orders?.order_Status);
  const [tracking_Code, setTracking_Code] = useState(orders?.tracking_Code);
  const { id } = useTelegramUser();
  const onChange = (e) => {
    setStatus(e.target.value);
  };
  const handleSubmitStatus = () => {
    mutation.mutate(
      {
        order_Status: status,
        tracking_Code: tracking_Code || "",
        user_Id: id.toString()
      },
      {
        onSuccess: () => {
          message.success("Статус обновлён");
        },
        onError: () => {
          message.error("Произошла ошибка");
        }
      }
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Divider>Статус заказа</Divider>
      <Radio.Group onChange={onChange} defaultValue={status} value={status}>
        <Radio.Button value="Pending">Ожидает подтверждения</Radio.Button>
        <Radio.Button value="Processing">В обработке</Radio.Button>
        <Radio.Button value="Packing">Упаковка</Radio.Button>
        <Radio.Button value="CancelledByCustomer">
          Отменён клиентом
        </Radio.Button>
        <Radio.Button value="CancelledDueToUnavailability">
          Нет в наличии (1 или несколько товаров)
        </Radio.Button>
        <Radio.Button value="CancelledByAdmin">
          Отменён администратором
        </Radio.Button>
        <Radio.Button value="Shipped">Доставлен</Radio.Button>
      </Radio.Group>

      <div className="flex flex-col ">
        <div className="text-left">Трек-код:</div>
        <Input
          onChange={(e) => {
            setTracking_Code(e.target.value);
          }}
          value={tracking_Code}
        />
      </div>
      <Button
        loading={mutation.isLoading}
        onClick={handleSubmitStatus}
        className=" mt-10 w-full "
        size="large"
        type="primary"
        ghost>
        Сохранить
      </Button>
    </div>
  );
}

export default OrderSetting;
