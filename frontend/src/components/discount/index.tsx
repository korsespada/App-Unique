import useAddDiscounts from "@framework/api/discount/add";
import useDeleteDiscount from "@framework/api/discount/delete";
import useUpdateDiscount from "@framework/api/discount/update";
import { TypeDiscount } from "@framework/types";
import useTelegramUser from "@hooks/useTelegramUser";
import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Form,
  InputNumber,
  message,
  Popconfirm
} from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useState } from "react";

dayjs.locale("ru");

interface Props {
  type: "product" | "category";
  id: string;
  data: TypeDiscount | null;
}

function Discount({ type, id, data }: Props) {
  const { id: userId } = useTelegramUser();
  const mutation = useAddDiscounts();
  const updateMutation = useUpdateDiscount({
    discount_id: data?.discount_Id || ""
  });
  const deleteMutation = useDeleteDiscount();

  const disabledDate: RangePickerProps["disabledDate"] = (current) =>
    current && current < dayjs().endOf("day");

  const handleDeleteDiscount = () => {
    deleteMutation.mutate(
      {
        discount_id: data?.discount_Id,
        user_id: userId?.toString() || ""
      },
      {
        onSuccess: () => {
          message.success("Скидка удалена");
          window.location.reload();
        },
        onError: () => {
          message.error("Не удалось удалить скидку");
        }
      }
    );
  };

  return (
    <div>
      <Divider>Скидки</Divider>
      <Form
        labelCol={{ span: 5 }}
        wrapperCol={{ span: 20 }}
        initialValues={{
          percent: data?.discount_Value,
          discount_start_date: data ? dayjs(data?.discount_Start_Date) : null,
          discount_end_date: data ? dayjs(data?.discount_End_Date) : null
        }}
        layout="horizontal"
        className="flex w-full flex-col justify-center gap-4"
        onFinish={({ percent, discount_start_date, discount_end_date }) => {
          const values = {
            category_id: type === "category" ? parseInt(id, 10) : null,
            product_id: type === "product" ? parseInt(id, 10) : null,
            discount_type: "percent" as const,
            discount_value: percent,
            discount_start_date:
              dayjs(discount_start_date.$d).toISOString() || "",
            discount_end_date: dayjs(discount_end_date.$d).toISOString() || "",
            user_id: userId?.toString() || ""
          };
          if (data) {
            updateMutation.mutate(
              {
                ...values,
                discount_Id: data.discount_Id
              },
              {
                onSuccess: () => {
                  message.success("Скидка сохранена");
                },
                onError: () => {
                  message.error("Не удалось сохранить скидку");
                }
              }
            );
          } else {
            mutation.mutate(values, {
              onSuccess: () => {
                message.success("Скидка сохранена");
              },
              onError: () => {
                message.error("Не удалось сохранить скидку");
              }
            });
          }
        }}>
        <Alert
          type="info"
          message="Скидка применяется в диапазоне от 1% до 100%"
          showIcon
        />
        <Form.Item name="percent" required label="Процент">
          <InputNumber min={1} addonAfter="%" max={100} required />
        </Form.Item>

        <Form.Item name="discount_start_date" required label="Дата начала">
          <DatePicker />
        </Form.Item>
        <Form.Item name="discount_end_date" required label="Дата окончания">
          <DatePicker disabledDate={disabledDate} />
        </Form.Item>

        <div className="flex gap-3">
          {data && (
            <Popconfirm
              placement="top"
              title="Удалить скидку?"
              onConfirm={() => handleDeleteDiscount()}
              okText="Удалить"
              okType="default"
              cancelText="Отмена">
              <Button
                size="large"
                loading={deleteMutation.isLoading}
                style={{ width: "36%" }}
                danger>
                Удалить скидку
              </Button>
            </Popconfirm>
          )}
          <Button
            type="primary"
            loading={mutation.isLoading}
            style={{ width: data ? "65%" : "100%" }}
            size="large"
            ghost
            htmlType="submit">
            Сохранить
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default Discount;
