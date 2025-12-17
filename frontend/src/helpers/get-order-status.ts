export const GetOrderStatus = (e: string) => {
  switch (e) {
    case "Pending":
      return "Ожидает подтверждения";
    case "Processing":
      return "В обработке";
    case "Packing":
      return "Упаковка";
    case "CancelledByCustomer":
      return "Отменён клиентом";
    case "CancelledDueToUnavailability":
      return "Нет в наличии (1 или несколько товаров)";
    case "CancelledByAdmin":
      return "Отменён администратором";
    case "Shipped":
      return "Доставлен";
    default:
      return "Ожидает подтверждения";
  }
};
