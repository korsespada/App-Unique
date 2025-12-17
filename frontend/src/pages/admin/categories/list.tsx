/* eslint-disable camelcase */
/* eslint-disable object-curly-newline */
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
// eslint-disable-next-line import/extensions
import Container from "@components/container";
import useDeleteCategories from "@framework/api/categories/delete";
import { useGetCategories } from "@framework/api/categories/get";
import { TypeCategories } from "@framework/types";
import useTelegramUser from "@hooks/useTelegramUser";
import { Button, message, Modal, Space, Table } from "antd";
import { ColumnsType } from "antd/es/table";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router-dom";

const { confirm } = Modal;
function List() {
  const { data, error, isLoading, isFetching, refetch } = useGetCategories({});
  const mutationDelete = useDeleteCategories();
  const { id } = useTelegramUser();
  const navigate = useNavigate();

  const customizeData = () => {
    const childHandler = (childItem: any[]) => {
      if (childItem.length > 0) {
        return childItem.map((item) => {
          const c = {
            ...item,
            key: item.category_Id
          };

          if (item.children && item.children.length > 0) {
            c.children = childHandler(item.children);
          } else {
            c.children = null;
          }
          return c;
        });
      }
      return null;
    };
    return data?.map((item) => ({
      ...item,
      key: item.category_Id,
      children: childHandler(item.children)
    }));
  };

  const handleDelete = (cat_id: any) => {
    mutationDelete.mutate(
      { category_id: cat_id, user_id: id },
      {
        onSuccess: () => {
          message.success("Категория удалена");
          refetch();
        },
        onError: (err) => {
          if (err.response.status !== 404) {
            message.error("Не удалось удалить");
            refetch();
          } else {
            window.location.reload();
          }
        }
      }
    );
  };
  const config = (cat_id) => ({
    title: "Удалить эту категорию?",
    content: <>sdd</>,
    okType: "danger",
    cancelText: "Отмена",
    okText: "Удалить",
    onOk: () => handleDelete(cat_id)
  });
  useEffect(() => {
    refetch();
  }, []);
  const columns: ColumnsType<TypeCategories> = [
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      render: (_, record) => (
        <div className="m-0 w-full">{record.category_Name}</div>
      )
    },
    {
      title: "Действия",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Link
            state={record}
            to={`/admin/categories/edit/${record.category_Id}`}>
            <EditOutlined />
          </Link>
          <Button
            type="link"
            onClick={() => {
              confirm(config(record.category_Id));
            }}
            size="small"
            danger>
            <DeleteOutlined />
          </Button>
          <Link to={`/admin/categories/${record.category_Id}`}>
            Добавить подкатегорию
          </Link>
        </Space>
      )
    }
  ];

  return (
    <Container
      backwardUrl="/admin"
      customButton
      customButtonTitle="Добавить"
      customButtonOnClick={() => navigate("/admin/categories/null")}
      title="Категории">
      {/* <Container titleType="small" title="Добавить категорию">
        <div className="flex gap-2">
          <Input />
          <Button>Добавить</Button>
        </div>
      </Container> */}
      <div className="mb-3" />
      {/* <Container titleType="small" title="Список категорий"> */}
      <Table
        columns={columns}
        loading={isLoading || isFetching}
        dataSource={customizeData()}
      />
      {/* </Container> */}
      {/* <CategoriesAdd isOpen={AddCategoriesDrawer} onClose={onClose} /> */}
    </Container>
  );
}

export default List;
