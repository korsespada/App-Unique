import Container from "@components/container";
import useGetUserInfo from "@framework/api/user-information/get";
import useUpdateUser from "@framework/api/user-information/update";
import useTelegramUser from "@hooks/useTelegramUser";
import { phoneNumberValidator } from "@persian-tools/persian-tools";
import { Button, Form, Input, message, Spin } from "antd";
import { useNavigate } from "react-router";

function EditProfile() {
  const [form] = Form.useForm();
  const { id } = useTelegramUser();
  const { data, isFetching, isLoading } = useGetUserInfo({ user_Id: id });
  const mutation = useUpdateUser({ user_id: id });
  const navigate = useNavigate();
  const dataLoading = isFetching || isLoading;
  return (
    <Container title="Редактировать профиль" backwardUrl={-1}>
      <Spin spinning={dataLoading}>
        {dataLoading ? (
          <div className="h-[350px]" />
        ) : (
          <Form
            name="basic"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            style={{ maxWidth: 600 }}
            initialValues={{
              phone_number: data?.phone_Number,
              name: data?.name,
              last_name: data?.last_Name,
              email: data?.email,
              username: data?.username
            }}
            onFinish={(e) => {
              console.log(e);
              if (!phoneNumberValidator(e.phone_number)) {
                message.error("Неверный номер телефона");
                form.scrollToField("phone_number");
              } else {
                mutation.mutate(e, {
                  onSuccess: () => {
                    message.success("Профиль обновлён");
                    navigate(-1);
                  },
                  onError: (e) => {
                    message.error("Ошибка при обновлении профиля");
                  }
                });
              }
            }}
            autoComplete="off">
            <Form.Item
              label="Имя"
              name="name"
              rules={[{ required: true, message: "Обязательно" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label="Фамилия"
              name="last_name"
              rules={[{ required: true, message: "Обязательно" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Имя пользователя" name="username">
              <Input disabled />
            </Form.Item>
            <Form.Item
              label="Email"
              rules={[{ required: true, message: "Обязательно" }]}
              name="email">
              <Input typeof="email" />
            </Form.Item>
            <Form.Item
              label="Телефон"
              name="phone_number"
              rules={[
                {
                  required: true,
                  message: "Обязательно",
                  min: 11,
                  max: 11
                }
              ]}>
              <Input />
            </Form.Item>

            <Form.Item>
              <Button className="w-full " size="large" htmlType="submit">
                Сохранить
              </Button>
            </Form.Item>
          </Form>
        )}
      </Spin>
    </Container>
  );
}

export default EditProfile;
