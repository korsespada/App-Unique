/* eslint-disable react/jsx-one-expression-per-line */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/jsx-wrap-multilines */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable operator-linebreak */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
import Container from "@components/container";
import { useGetAddresses } from "@framework/api/address/get";
import { useGetCarts } from "@framework/api/cart/get";
import useAddOrder from "@framework/api/orders/add";
import useAddReceiptPhotos from "@framework/api/receipt-photos/add";
import useTelegramUser from "@hooks/useTelegramUser";
import { addCommas } from "@persian-tools/persian-tools";
import { Alert, Button, Form, Input, message, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import ImageUploading from "react-images-uploading";
import { useLocation, useNavigate } from "react-router";

function Checkout() {
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [receiptPhoto, setReceiptPhoto] = useState<null | string>(null);
  const { id } = useTelegramUser();
  const { state: locState } = useLocation();
  const navigate = useNavigate();
  const mutationPhotos = useAddReceiptPhotos();
  const mutationOrder = useAddOrder();

  const {
    data: CartData,
    isFetching: CartFetching,
    isLoading: CartLoading
  } = useGetCarts(id);

  const onChangeImage = async (imageList) => {
    imageList.length && setImagesLoading(true);
    // setImages(imageList);
    imageList.length &&
      mutationPhotos.mutate(
        {
          photo_base64: imageList[0].data_url.split(",")[1]
        },
        {
          onSuccess: (e) => {
            setImages(imageList);
            setReceiptPhoto(`${e.data}`);
            setImagesLoading(false);
          },

          onError: () => {
            message.error("Ошибка при загрузке фото. Попробуйте ещё раз!");
            setImagesLoading(false);
          }
        }
      );
  };
  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };
  const { data, error, refetch, isFetching, isLoading } = useGetAddresses(id);

  useEffect(() => {
    if (!locState) {
      navigate("/");
    } else {
      refetch();
    }
  }, [locState]);

  useEffect(() => {
    if (!data || !data?.addresses) {
      // navigate("/profile/address/add");
      message.warning({
        content: "Перед оплатой нужно добавить адрес",
        duration: 3
      });
    }
  }, [data, error]);
  const personCart = {
    name: "Sina Salehi",
    cartNumber: "6219861065233172"
  };
  return (
    <Container title="Оплата и оформление заказа" backwardUrl={-1}>
      <div>
        <Alert
          message={
            <div>
              <div className="mb-2">Реквизиты для оплаты</div>
              <div className="flex flex-col items-center justify-center">
                <div
                  className="flex w-fit items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-1 "
                  onClick={() => {
                    navigator.clipboard.writeText(personCart.cartNumber);
                    message.success("Номер карты скопирован");
                  }}>
                  <div>Номер карты: {personCart.cartNumber}</div>
                  <Button>Копировать</Button>
                </div>
                <br />
                <span>
                  Получатель:
                  <b className="mr-2 text-lg">{personCart.name}</b>
                </span>
                <br />

                <span>
                  Сумма к оплате:
                  <b className="mr-2 gap-3 text-lg">
                    {addCommas(CartData?.totalPrice) || 0} <span>₽</span>
                  </b>
                </span>
              </div>
            </div>
          }
          type="info"
          showIcon
        />
        <br />
        <Alert
          message="Загрузка фото чека об оплате обязательна. После загрузки вы сможете оформить заказ"
          type="warning"
          showIcon
        />

        <Form
          className="mt-5"
          name="basic"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          style={{ maxWidth: 600 }}
          onFinish={(val) => {
            if (receiptPhoto) {
              mutationOrder.mutate(
                {
                  order_Description: val.order_Description,
                  shipping_Cost: 0,
                  receipt_Photo_Path: receiptPhoto,
                  user_Address_Id: val.address,
                  user_Id: `${id}`
                },
                {
                  onSuccess: () => {
                    message.success(
                      "Заказ успешно оформлен. Отслеживать заказ можно в личном кабинете."
                    );
                    navigate("/");
                  }
                }
              );
            } else {
              message.error("Пожалуйста, загрузите фото чека об оплате.");
            }
          }}
          onFinishFailed={onFinishFailed}
          autoComplete="off">
          <Spin spinning={imagesLoading} tip="Загрузка...">
            <Form.Item
              className="mb-14 w-full"
              name="photos"
              label="Фото чека об оплате"
              required
              valuePropName="photos">
              <ImageUploading
                value={images}
                onChange={onChangeImage}
                maxNumber={1}
                dataURLKey="data_url">
                {({ onImageUpload, onImageRemove, isDragging, dragProps }) => (
                  // write your building UI
  <div className="upload__image-wrapper flex flex-col">
                    {!images.length && (
    <div className="mb-5 flex h-[60px]  w-full">
                        <button
        style={isDragging ? { color: "red" } : undefined}
        onClick={onImageUpload}
        type="button"
        className="h-full w-full border-[1px] border-dashed"
        {...dragProps}>
        Добавить фото
                        </button>
                      </div>
    )}
                    <div className="grid h-fit w-full grid-cols-1 grid-rows-1  gap-y-7   ">
      {images?.map((image, index) => (
                        <div
          key={index}
          className=" flex h-full w-full flex-col gap-2 rounded-lg">
          <img
                            src={image.data_url}
                            alt=""
                            className="h-full w-full rounded-lg "
                          />
          <div className="flex justify-between gap-3">
                            <Button
              danger
              className="w-full"
              htmlType="button"
              onClick={() => {
                                setReceiptPhoto(null);
                                setImages([]);
                              }}>
              Удалить
                            </Button>
                          </div>
        </div>
                      ))}
    </div>
                  </div>
                )}
              </ImageUploading>
            </Form.Item>
          </Spin>

          <Form.Item name="address" label="Адрес" rules={[{ required: true }]}>
            <Select
              loading={isFetching || isLoading}
              placeholder="Выберите адрес"
              allowClear>
              {data?.addresses.map((item) => (
                <Select.Option value={item.address_Id}>
                  {item.country},{item.state},{item.city},{item.street},
                  {item.zipcode} ...
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="order_Description" label="Комментарий к заказу">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Button
            disabled={images.length === 0 && data?.addresses.length === 0}
            loading={mutationOrder.isLoading}
            type="default"
            className="w-full"
            size="large"
            htmlType="submit">
            Оформить заказ
          </Button>
        </Form>
      </div>
    </Container>
  );
}

export default Checkout;
