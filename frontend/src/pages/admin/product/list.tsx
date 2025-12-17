/* eslint-disable no-nested-ternary */
/* eslint-disable object-curly-newline */
import Container from "@components/container";
import ProductLists from "@components/product/list";
import { useNavigate } from "react-router";

function ProductList() {
  const navigate = useNavigate();
  // const { data, error, refetch, isLoading, isFetching } = useGetProducts({});
  // useEffect(() => {
  //   refetch();
  // }, []);

  return (
    <Container
      title="Товары"
      backwardUrl="/admin"
      customButton
      customButtonTitle="Добавить"
      customButtonOnClick={() => navigate("/admin/products/add")}>
      {/* <Suspense fallback={<ProductsSkeleton />}> */}
      {/* {isLoading || isFetching ? (
        <ProductsSkeleton />
      ) : error ? (
        <>Произошла ошибка</>
      ) : data?.products.length === 0 ? (
        <Empty description="Нет данных" />
      ) : (
        <ProductLists pageType="admin" data={data} />
      )} */}
      <ProductLists pageType="admin" />

      {/* </Suspense> */}
    </Container>
  );
}

export default ProductList;
