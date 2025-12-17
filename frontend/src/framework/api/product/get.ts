/* eslint-disable implicit-arrow-linebreak */
import { TypeListProducts } from "@framework/types";
import { QueryFunction, useQuery } from "@tanstack/react-query";
import qs from "query-string";

import Api from "../utils/api-config";

type ProductsQueryKey = readonly [
  string,
  number | undefined,
  number | undefined,
  number | undefined,
  string | undefined,
  "asc" | "desc" | undefined,
  number | undefined,
  "Product_Name" | "Updated_At" | "Price" | undefined
];

interface Props {
  name?: string;
  sortBy?: "Product_Name" | "Updated_At" | "Price";
  order?: "asc" | "desc";
  limit?: number;
  page?: number;
  categoryId?: number;
  brandId?: number;
}

const fetch: QueryFunction<TypeListProducts, ProductsQueryKey> = async ({
  queryKey
}) => {
  const [, brandId, categoryId, limit, name, order, page, sortBy] = queryKey;
  const { data } = await Api.get(
    `/products?${qs.stringify({
      brandId,
      categoryId,
      limit,
      name,
      order,
      page,
      sortBy
    })}`
  );
  return data as TypeListProducts;
};

export const useGetProducts = ({
  brandId,
  categoryId,
  limit = 10,
  name,
  order,
  page = 1,
  sortBy = "Price"
}: Props) =>
  useQuery<TypeListProducts, Error, TypeListProducts, ProductsQueryKey>(
    [
      "products",
      brandId,
      categoryId,
      limit,
      name,
      order,
      page,
      sortBy
    ] as ProductsQueryKey,
    fetch
  );
