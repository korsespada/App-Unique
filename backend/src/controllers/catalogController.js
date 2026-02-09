const axios = require("axios");
const cacheManager = require("../cacheManager");
const { extractAxiosStatus } = require("../utils/apiHelpers");
const { pbApi } = require("../pocketbaseClient");

let lastGoodCatalogFilters = null;
let catalogFiltersErrorCount = 0;

function setCatalogCacheHeaders(res) {
    res.set("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
}

async function handleCatalogFilters(req, res) {
    const cacheKey = "catalog-filters:v5";
    const cached = cacheManager.get("products", cacheKey);
    if (cached) {
        console.log("Using cached catalog filters");
        setCatalogCacheHeaders(res);
        return res.json(cached);
    }

    const pb = pbApi();

    try {
        async function loadFiltersFromProducts() {
            const pbProducts = pbApi();
            pbProducts.defaults.timeout = 30000;

            // Load products (without subcategory - it's loaded separately)
            const firstResp = await pbProducts.get(
                "/api/collections/products/records",
                {
                    params: {
                        page: 1,
                        perPage: 2000,
                        filter: 'status = "active"',
                        sort: "-updated",
                        fields: "id,brand,category",
                    },
                }
            );

            const firstData = firstResp?.data;
            const totalPages = Math.max(1, Number(firstData?.totalPages) || 1);
            const items = Array.isArray(firstData?.items) ? firstData.items : [];

            if (totalPages > 1) {
                const pagePromises = [];
                for (let page = 2; page <= totalPages; page += 1) {
                    pagePromises.push(
                        pbProducts.get("/api/collections/products/records", {
                            params: {
                                page,
                                perPage: 2000,
                                filter: 'status = "active"',
                                sort: "-updated",
                                fields: "id,brand,category",
                            },
                        })
                    );
                }
                const responses = await Promise.all(pagePromises);
                for (const resp of responses) {
                    const data = resp?.data;
                    if (data && Array.isArray(data.items)) items.push(...data.items);
                }
            }

            // Collect unique IDs
            const brandIds = new Set();
            const categoryIds = new Set();

            for (const p of items) {
                const brandId = String(p?.brand || "").trim();
                const categoryId = String(p?.category || "").trim();
                if (brandId) brandIds.add(brandId);
                if (categoryId) categoryIds.add(categoryId);
            }

            // Load brands, categories, and ALL subcategories (with their category relation)
            const [brandsData, categoriesData, subcategoriesData] = await Promise.all([
                brandIds.size > 0
                    ? pb.get("/api/collections/brands/records", {
                        params: {
                            page: 1,
                            perPage: 500,
                            filter: Array.from(brandIds)
                                .map((id) => `id="${id}"`)
                                .join(" || "),
                            fields: "id,name",
                        },
                    })
                    : { data: { items: [] } },
                // Load ALL categories (for subcategory mapping)
                pb.get("/api/collections/categories/records", {
                    params: {
                        page: 1,
                        perPage: 500,
                        fields: "id,name",
                    },
                }),
                // Load ALL subcategories (without expand for speed)
                pb.get("/api/collections/subcategories/records", {
                    params: {
                        page: 1,
                        perPage: 500,
                    },
                }),
            ]);

            // Create lookup maps
            const brandMap = new Map(
                (brandsData?.data?.items || []).map((b) => [
                    String(b.id),
                    String(b.name || "").trim(),
                ])
            );
            const categoryMap = new Map(
                (categoriesData?.data?.items || []).map((c) => [
                    String(c.id),
                    String(c.name || "").trim(),
                ])
            );

            // Build subcategoriesByCategory from subcategories collection
            const subcategoriesSet = new Set();
            const subcategoriesByCategorySet = new Map();
            const subcategoryItems = subcategoriesData?.data?.items || [];
            console.log("PB URL:", process.env.PB_URL ? (process.env.PB_URL.substring(0, 10) + "...") : "NOT SET");
            console.log("Subcategories Raw Data Items Length:", subcategoriesData?.data?.items?.length);
            console.log("Subcategories Total Items from PB:", subcategoriesData?.data?.totalItems);

            if (subcategoryItems.length === 0) {
                console.warn("WARNING: No subcategories found in PocketBase! Check API Rules for 'subcategories' collection.");
            }

            for (const sub of subcategoryItems) {
                const subcategoryName = String(sub?.name || "").trim();
                if (!subcategoryName) continue;

                subcategoriesSet.add(subcategoryName);

                // Get category name from categoryMap using category ID
                const categoryId = String(sub?.category || "").trim();
                const categoryName = categoryMap.get(categoryId) || "";
                if (categoryName) {
                    if (!subcategoriesByCategorySet.has(categoryName)) {
                        subcategoriesByCategorySet.set(categoryName, new Set());
                    }
                    subcategoriesByCategorySet.get(categoryName).add(subcategoryName);
                }
            }

            // Build filter data from products
            const categoriesSet = new Set();
            const brandsSet = new Set();
            const brandsByCategorySet = new Map();

            for (const p of items) {
                const categoryId = String(p?.category || "").trim();
                const brandId = String(p?.brand || "").trim();

                const categoryName = categoryMap.get(categoryId);
                const brandName = brandMap.get(brandId);

                if (categoryName) {
                    categoriesSet.add(categoryName);
                    if (!brandsByCategorySet.has(categoryName)) {
                        brandsByCategorySet.set(categoryName, new Set());
                    }
                    if (brandName) {
                        brandsByCategorySet.get(categoryName).add(brandName);
                    }
                }
                if (brandName) brandsSet.add(brandName);
            }

            const categories = Array.from(categoriesSet).sort((a, b) =>
                a.localeCompare(b)
            );
            const brands = Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
            const subcategories = Array.from(subcategoriesSet).sort((a, b) => a.localeCompare(b));

            const brandsByCategory = Object.fromEntries(
                categories.map((c) => {
                    const set = brandsByCategorySet.get(c);
                    const arr = set ? Array.from(set) : [];
                    arr.sort((a, b) => a.localeCompare(b));
                    return [c, arr];
                })
            );

            const subcategoriesByCategory = Object.fromEntries(
                categories.map((c) => {
                    const set = subcategoriesByCategorySet.get(c);
                    const arr = set ? Array.from(set) : [];
                    arr.sort((a, b) => a.localeCompare(b));
                    return [c, arr];
                })
            );

            return { categories, brands, subcategories, brandsByCategory, subcategoriesByCategory };
        }

        const fromProducts = await loadFiltersFromProducts();
        const payload = {
            categories: fromProducts.categories,
            brands: fromProducts.brands,
            subcategories: fromProducts.subcategories,
            brandsByCategory: fromProducts.brandsByCategory,
            subcategoriesByCategory: fromProducts.subcategoriesByCategory,
        };

        catalogFiltersErrorCount = 0;
        lastGoodCatalogFilters = payload;
        // OPTIMIZATION: Increase cache time from 12h to 24h since filters rarely change
        cacheManager.set("products", cacheKey, payload, 24 * 60 * 60);
        setCatalogCacheHeaders(res);
        return res.json(payload);

    } catch (err) {
        const status = extractAxiosStatus(err);
        console.error("Catalog filters load failed", {
            status,
            message: err?.message || err,
        });

        // Rate limit handling - exponential backoff
        if (status === 403 || status === 429) {
            catalogFiltersErrorCount++;
            const backoffSeconds = Math.min(
                300,
                Math.pow(2, catalogFiltersErrorCount)
            );
            console.log(
                `Rate limited, backing off for ${backoffSeconds}s (attempt ${catalogFiltersErrorCount})`
            );

            const fallback = lastGoodCatalogFilters || {
                categories: [],
                brands: [],
                subcategories: [],
                brandsByCategory: {},
                subcategoriesByCategory: {},
            };

            cacheManager.set("products", cacheKey, fallback, backoffSeconds);
            setCatalogCacheHeaders(res);
            return res.json(fallback);
        }

        let fallback = lastGoodCatalogFilters;
        if (!fallback) {
            // Emergency fallback logic omitted for brevity in refactor, or can be kept if desired.
            // Keeping simple fallback for now.
            fallback = {
                categories: [],
                brands: [],
                subcategories: [],
                brandsByCategory: {},
                subcategoriesByCategory: {},
            };
        }

        cacheManager.set("products", cacheKey, fallback, 60);
        setCatalogCacheHeaders(res);
        return res.json(fallback);
    }
}

module.exports = {
    handleCatalogFilters,
};
