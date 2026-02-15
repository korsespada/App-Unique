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
        // ОПТИМИЗАЦИЯ: Загружаем фильтры напрямую из коллекций, минуя products
        // Это снижает нагрузку на VPS с 100% до ~1% при деплое/прогреве

        // 1. Загружаем все бренды
        const brandsResp = await pb.get("/api/collections/brands/records", {
            params: {
                page: 1,
                perPage: 500,
                fields: "id,name",
                sort: "name",
            }
        });
        const brandsItems = Array.isArray(brandsResp?.data?.items) ? brandsResp.data.items : [];
        const brands = brandsItems.map(b => String(b.name || "").trim()).filter(Boolean);

        // 2. Загружаем все категории
        const categoriesResp = await pb.get("/api/collections/categories/records", {
            params: {
                page: 1,
                perPage: 500,
                fields: "id,name",
                sort: "name",
            }
        });
        const categoriesItems = Array.isArray(categoriesResp?.data?.items) ? categoriesResp.data.items : [];
        const categories = categoriesItems.map(c => String(c.name || "").trim()).filter(Boolean);
        const categoryMap = new Map(categoriesItems.map(c => [c.id, String(c.name || "").trim()]));

        // 3. Загружаем все подкатегории
        const subcategoriesResp = await pb.get("/api/collections/subcategories/records", {
            params: {
                page: 1,
                perPage: 500,
                fields: "id,name,category",
                sort: "name",
            }
        });
        const subcategoriesItems = Array.isArray(subcategoriesResp?.data?.items) ? subcategoriesResp.data.items : [];
        const subcategories = subcategoriesItems.map(s => String(s.name || "").trim()).filter(Boolean);

        // 4. Строим связи

        // subcategoriesByCategory
        const subcategoriesByCategory = {};
        for (const catName of categories) {
            subcategoriesByCategory[catName] = [];
        }
        for (const sub of subcategoriesItems) {
            const catId = sub.category;
            const subName = String(sub.name || "").trim();
            if (catId && subName) {
                const catName = categoryMap.get(catId);
                if (catName && subcategoriesByCategory[catName]) {
                    subcategoriesByCategory[catName].push(subName);
                }
            }
        }

        // Заглушки для матриц брендов (разрешаем всё везде)
        const brandsByCategory = {};
        for (const catName of categories) brandsByCategory[catName] = [...brands];

        const brandsBySubcategory = {};
        for (const subName of subcategories) brandsBySubcategory[subName] = [...brands];

        const subcategoriesByBrand = {};
        for (const brandName of brands) subcategoriesByBrand[brandName] = [...subcategories];

        const payload = {
            categories,
            brands,
            subcategories,
            brandsByCategory,
            subcategoriesByCategory,
            brandsBySubcategory,
            subcategoriesByBrand,
        };

        catalogFiltersErrorCount = 0;
        lastGoodCatalogFilters = payload;

        // Кэшируем на 24 часа
        cacheManager.set("products", cacheKey, payload, 24 * 60 * 60);
        setCatalogCacheHeaders(res);
        return res.json(payload);

    } catch (err) {
        const status = extractAxiosStatus(err);
        console.error("Catalog filters load failed", {
            status,
            message: err?.message || err,
        });

        if (status === 403 || status === 429) {
            catalogFiltersErrorCount++;
            const backoffSeconds = Math.min(300, Math.pow(2, catalogFiltersErrorCount));
            console.log(`Rate limited, backing off for ${backoffSeconds}s`);

            const fallback = lastGoodCatalogFilters || {
                categories: [], brands: [], subcategories: [],
                brandsByCategory: {}, subcategoriesByCategory: {}
            };
            cacheManager.set("products", cacheKey, fallback, backoffSeconds);
            setCatalogCacheHeaders(res);
            return res.json(fallback);
        }

        let fallback = lastGoodCatalogFilters;
        if (!fallback) {
            return res.status(503).json({ error: "Catalog unavailable", retryAfter: 60 });
        }

        cacheManager.set("products", cacheKey, fallback, 60);
        setCatalogCacheHeaders(res);
        return res.json(fallback);
    }
}

module.exports = {
    handleCatalogFilters,
};
