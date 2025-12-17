/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
/* eslint-disable react/jsx-wrap-multilines */

import Container from "@components/container";
import useDeleteAddress from "@framework/api/address/delete";
import { useGetAddresses } from "@framework/api/address/get";
import useTelegramUser from "@hooks/useTelegramUser";
import { Button, List, message, Popconfirm } from "antd";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

function AddessesList() {
  const navigate = useNavigate();
  const id = useTelegramUser()?.id ?? 0;
  const { data, isLoading, isFetching, refetch } = useGetAddresses(id);
  const deleteMutation = useDeleteAddress();
  const location = useLocation();
  useEffect(() => {
    refetch();
  }, [location]);
  return (
    <Container
      title="Адреса"
      customButton
      customButtonTitle="Добавить адрес"
      customButtonOnClick={() => navigate("add")}
      backwardUrl="/">
      <List
        loading={isLoading || isFetching}
        itemLayout="horizontal"
        dataSource={data?.addresses}
        renderItem={(item, index) => (
          <List.Item key={index}>
            <List.Item.Meta
              // avatar={
              //   <Avatar
              //     src={`https://xsgames.co/randomusers/avatar.php?g=pixel&key=${index}`}
              //   />
              // }
              title={<div className="w-full text-start">{item.city}</div>}
              description={
                <div className="flex gap-3  ">
                  <div className="flex flex-row gap-2">
                    <span>{item.state}</span>
                  </div>
                  <div>
                    <span>{item.zipcode}</span>
                  </div>
                </div>
              }
            />

            <div className="flex gap-2">
              <Popconfirm
                placement="left"
                title="Удалить адрес?"
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                onConfirm={() => {
                  deleteMutation.mutate(
                    { user_id: id, address_id: item.address_Id ?? 0 },
                    {
                      onSuccess: () => {
                        message.success("Адрес удалён");
                        refetch();
                      },
                      onError: (e) => {
                        console.log(e);
                        message.error(
                          "Не удалось удалить. Попробуйте ещё раз!"
                        );
                        refetch();
                      }
                    }
                  );
                }}
                okText="Удалить"
                okType="default"
                cancelText="Отмена">
                <Button
                  key={index}
                  size="small"
                  loading={deleteMutation.isLoading}>
                  Удалить
                </Button>
              </Popconfirm>
              <Button
                onClick={() => navigate(`${item.address_Id}`)}
                size="small">
                Редактировать
              </Button>
            </div>
          </List.Item>
        )}
      />
    </Container>
  );
}

export default AddessesList;
