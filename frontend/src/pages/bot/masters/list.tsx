/* eslint-disable camelcase */
/* eslint-disable no-nested-ternary */
/* eslint-disable object-curly-newline */
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import Container from "@components/container";
import useDeleteMaster from "@framework/api/master/delete";
import { useGetMasters } from "@framework/api/master/get";
import useTelegramUser from "@hooks/useTelegramUser";
import { Button, Popconfirm, Space, Table, message } from "antd";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Link } from "react-router-dom";

function BotMastersList() {
  const navigate = useNavigate();
  const { data, isFetching, isLoading, refetch } = useGetMasters();
  const deleteMutation = useDeleteMaster();
  const location = useLocation();
  const { id: user_id } = useTelegramUser();
  const handleDeleteMaster = (id: string) => {
    deleteMutation.mutate(
      {
        master_id: id,
        user_id
      },
      {
        onSuccess: () => {
          message.success("Пользователь удалён");
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
    title: `${item.name} ${item.last_Name} `,
    key: item.id
  }));
  useEffect(() => {
    refetch();
  }, [location, refetch]);

  const columns = [
    {
      title: "Имя",
      dataIndex: "title",
      key: "name"
    },
    {
      title: "Действия",
      dataIndex: "actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Link state={record} to={`${record.id}`}>
            <EditOutlined />
          </Link>
          <Popconfirm
            placement="top"
            title="Удалить этого мастера?"
            onConfirm={() => handleDeleteMaster(record.id)}
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
      title="Мастера"
      backwardUrl="/bot"
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

export default BotMastersList;
