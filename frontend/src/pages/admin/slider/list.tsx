/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable camelcase */
/* eslint-disable no-nested-ternary */
/* eslint-disable object-curly-newline */
import { DeleteOutlined } from "@ant-design/icons";
import Container from "@components/container";
import useDeleteSlider from "@framework/api/slider/delete";
import { useGetSliders } from "@framework/api/slider/get";
import useTelegramUser from "@hooks/useTelegramUser";
import { Button, message, Popconfirm, Space, Table } from "antd";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

function list() {
  const navigate = useNavigate();
  const { data, isFetching, isLoading, refetch } = useGetSliders();
  const deleteMutation = useDeleteSlider();
  const location = useLocation();
  const { id: user_id } = useTelegramUser();
  const handleDeleteSlide = (id: string) => {
    deleteMutation.mutate(
      {
        master_id: id,
        user_id
      },
      {
        onSuccess: () => {
          message.success("Слайд удалён");
          refetch();
        },
        onError: () => {
          message.error("Ошибка при удалении");
          refetch();
        }
      }
    );
  };

  const dataSource = data?.map((item) => ({
    ...item,

    key: item.id
  }));
  useEffect(() => {
    refetch();
  }, [location, refetch]);

  const columns = [
    {
      title: "Название",
      key: "name",
      render: (_, record) => (
        <div className="h-full w-14">
          <img
            src={`${import.meta.env.VITE_API_URL}/${record.photo_Path}`}
            alt="slider"
          />
        </div>
      )
    },
    {
      title: "Действия",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            placement="top"
            title="Удалить этот слайд?"
            onConfirm={() => handleDeleteSlide(record.id)}
            okText="Удалить"
            okType="default"
            cancelText="Отмена">
            <Button type="link" size="small" danger>
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];
  return (
    <Container
      title="Слайдер"
      backwardUrl="/admin"
      customButton
      customButtonTitle="Добавить"
      customButtonOnClick={() => navigate("add")}>
      <Table
        loading={isFetching || isLoading || deleteMutation.isLoading}
        dataSource={dataSource}
        columns={columns}
      />
    </Container>
  );
}

export default list;
