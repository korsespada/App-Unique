import axios from "axios";

export type PocketBaseListResponse<T> = {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  items: T[];
};

export type PocketBaseRecordBase = {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

export type PocketBaseProductRecord = PocketBaseRecordBase & {
  productid: string;
  titletext?: string;
  description?: string;
  brand?: string;
  category?: string;
  seotitle?: string;
  price?: number;
  status?: string;
};

export type PocketBaseProductPhotoRecord = PocketBaseRecordBase & {
  productid: string;
  photofilename?: string;
  photourl?: string;
  photoorder?: number;
  ismain?: boolean;
};

export type ProductsQueryParams = {
  search?: string;
  brand?: string;
  category?: string;
  page?: number;
  perPage?: number;
};

// UI Product used in new-ui/App.tsx
export type UiProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  hasPrice: boolean;
  images: string[];
  description: string;
  details: string[];
};

const PB_BASE_URL = String(import.meta.env.VITEAPIBASEURL || "")
  .trim()
  .replace(/\/$/, "");

function getTelegramInitDataHeader(): Record<string, string> {
  try {
    const initData = (window as any)?.Telegram?.WebApp?.initData;
    if (initData && typeof initData === "string") {
      return { "X-Telegram-Init-Data": initData };
    }
  } catch {
    // ignore
  }
  return {};
}

function pbApi() {
  if (!PB_BASE_URL) {
    throw new Error("VITEAPIBASEURL is not set");
  }

  return axios.create({
    baseURL: PB_BASE_URL,
    headers: {
      Accept: "application/json",
      ...getTelegramInitDataHeader()
    }
  });
}

function buildPbFilter(params: ProductsQueryParams): string {
  const parts: string[] = [];

  const safe = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"").trim();

  if (params.search && params.search.trim()) {
    // PocketBase filter supports contains via ~
    // Search by productid OR titletext OR brand OR category
    const q = safe(params.search);
    parts.push(
      `productid ~ "${q}" || titletext ~ "${q}" || brand ~ "${q}" || category ~ "${q}"`
    );
  }

  if (params.brand && params.brand.trim() && params.brand !== "Все") {
    const b = safe(params.brand);
    parts.push(`brand = "${b}"`);
  }

  if (params.category && params.category.trim() && params.category !== "Все") {
    const c = safe(params.category);
    parts.push(`category = "${c}"`);
  }

  return parts.join(" && ");
}

function mapPbProductToUi(record: PocketBaseProductRecord): UiProduct {
  const name = String(
    record.titletext || record.seotitle || record.productid || ""
  ).trim();
  const brand = String(record.brand || "").trim() || " ";
  const category = String(record.category || "Все").trim() || "Все";

  const rawPrice = Number(record.price);
  const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;

  return {
    id: String(record.productid || record.id).trim(),
    name,
    brand,
    category,
    price: hasPrice ? rawPrice : 1,
    hasPrice,
    images: [],
    description: String(record.description || ""),
    details: []
  };
}

function sortPhotos(
  photos: PocketBaseProductPhotoRecord[]
): PocketBaseProductPhotoRecord[] {
  return [...photos].sort((a, b) => {
    const aMain = a.ismain ? 0 : 1;
    const bMain = b.ismain ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    const ao = Number(a.photoorder ?? 0);
    const bo = Number(b.photoorder ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a.id).localeCompare(String(b.id));
  });
}

export async function getProducts(
  params: ProductsQueryParams = {}
): Promise<{ products: UiProduct[] }> {
  const api = pbApi();

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 200);

  const filter = buildPbFilter(params);

  const { data } = await api.get<
    PocketBaseListResponse<PocketBaseProductRecord>
  >("/api/collections/products/records", {
    params: {
      page,
      perPage,
      ...(filter ? { filter } : {})
    },
    timeout: 30000
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const products = items.map(mapPbProductToUi);

  // Note: images filled in getProductById (detail). For list, we can optionally join photos,
  // but keeping it minimal: list shows first image if available via separate call later.
  return { products };
}

export async function getProductById(productId: string): Promise<UiProduct> {
  const api = pbApi();

  // productId in UI is products.productid
  // Fetch product record by filter (since PocketBase record id may differ)
  const filter = `productid = "${String(productId).replace(/\"/g, "\\\"")}"`;

  const { data: listData } = await api.get<
    PocketBaseListResponse<PocketBaseProductRecord>
  >("/api/collections/products/records", {
    params: { page: 1, perPage: 1, filter },
    timeout: 30000
  });

  const record = Array.isArray(listData?.items) ? listData.items[0] : null;
  if (!record) {
    throw new Error("Product not found");
  }

  const ui = mapPbProductToUi(record);

  const photosFilter = `productid = "${String(record.productid).replace(
    /\"/g,
    "\\\""
  )}"`;
  const { data: photosData } = await api.get<
    PocketBaseListResponse<PocketBaseProductPhotoRecord>
  >("/api/collections/productphotos/records", {
    params: { page: 1, perPage: 200, filter: photosFilter },
    timeout: 30000
  });

  const photos = Array.isArray(photosData?.items) ? photosData.items : [];
  const sorted = sortPhotos(photos);
  const images = sorted
    .map((p) => String(p.photourl || "").trim())
    .filter(Boolean);

  return {
    ...ui,
    images: images.length
      ? images
      : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000"]
  };
}
