import { Button } from "antd";
import { useNavigate } from "react-router-dom";

function Admin() {
  // const tgApp = useTelegram();

  // const userId = tgApp.initDataUnsafe.user.id;
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      Меню администратора
      {/*
      <MainButtonDemo />
      <BackButtonDemo />
      <ShowPopupDemo />
      <HapticFeedbackDemo /> */}
      <Button onClick={() => navigate("/admin/products")}>Товары</Button>
      <Button onClick={() => navigate("/admin/categories")}>Категории</Button>
      <Button onClick={() => navigate("/admin/orders")}>
        Заказы пользователей
      </Button>
      {/* <Button onClick={() => navigate("/admin/discounts")}>Скидки</Button> */}
      <Button onClick={() => navigate("/admin/slider")}>Слайдер</Button>
    </div>
  );
}

export default Admin;
