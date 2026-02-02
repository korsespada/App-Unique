const axios = require("axios");
const cacheManager = require("../cacheManager");
const {
    loadProductIdsOnly,
    loadProductsByIds,
    listActiveProducts,
    getActiveProductById,
} = require("../pocketbaseClient");
const {
    normalizeProductDescriptions,
    shuffleDeterministic,
    mixByCategoryRoundRobin,
    isValidPocketBaseId,
    normalizeDescription,
} = require("../utils/helpers");
const { extractAxiosStatus } = require("../utils/apiHelpers");

// Helper to set cache headers
function setCatalogCacheHeaders(res) {
    res.set("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
}

async function resolveRelationIdByName({ collection, name, pbUrl, pbHeaders }) {
    const safeName = String(name || "").trim();
    if (!safeName) return "";

    const cacheKey = `relid:${collection}:${safeName.toLowerCase()}`;
    const cached = cacheManager.get("relations", cacheKey);
    if (typeof cached === "string") return cached;

    const pb = axios.create({
        baseURL: pbUrl,
        timeout: 30000,
        headers: pbHeaders,
    });

    let resp;
    try {
        resp = await pb.get(`/api/collections/${collection}/records`, {
            params: {
                page: 1,
                perPage: 2000,
                fields: "id,name",
                sort: "name",
            },
        });
    } catch (err) {
        // Retry once
        resp = await pb.get(`/api/collections/${collection}/records`, {
            params: {
                page: 1,
                perPage: 2000,
                fields: "id,name",
                sort: "name",
            },
        });
    }

    const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
    const found = items.find((it) => String(it?.name || "").trim() === safeName);
    const id = found?.id ? String(found.id).trim() : "";

    if (!id) {
        // Cache empty result shorter
        cacheManager.set("relations", cacheKey, "", 5 * 60);
        return "";
    }

    cacheManager.set("relations", cacheKey, id);
    return id;
}

async function handleExternalProducts(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.max(1, Math.min(200, Number(req.query.perPage) || 40));
    const seed = String(req.query.seed || "").trim();

    const search = String(req.query.search || "")
        .replace(/\s+/g, " ")
        .trim();
    const brand = String(req.query.brand || "").trim();
    const category = String(req.query.category || "").trim();

    // Используем seed из параметров или дефолт
    const sessionSeed = seed || "default";

    const cacheKey = `external-products:${page}:${perPage}:${search}:${brand}:${category}:${sessionSeed}`;
    const cached = cacheManager.get("pages", cacheKey);
    if (cached) {
        setCatalogCacheHeaders(res);
        return res.json(normalizeProductDescriptions(cached));
    }

    const isHomeUnfiltered = !search && !brand && !category;
    if (isHomeUnfiltered) {
        const orderCacheKey = `order:home:${sessionSeed}`;
        let orderedIds = cacheManager.get("shuffle", orderCacheKey);

        if (!orderedIds) {
            let idRecords = await loadProductIdsOnly(2000, 'status = "active"');

            // Гарантируем стабильный входной порядок
            idRecords.sort((a, b) => String(a.id).localeCompare(String(b.id)));

            const shuffled = shuffleDeterministic(idRecords, `home:${sessionSeed}`);
            const mixed = mixByCategoryRoundRobin(shuffled, sessionSeed);
            orderedIds = mixed.map((p) => p.id);
            cacheManager.set("shuffle", orderCacheKey, orderedIds, 3600); // 1 час кэша в памяти
        }

        const totalItems = orderedIds.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * perPage;
        const end = start + perPage;
        const pageIds = orderedIds.slice(start, end);

        const pageProducts = await loadProductsByIds(pageIds);
        const pageItems = pageProducts.map((p) => {
            const thumb = typeof p?.thumb === "string" ? String(p.thumb).trim() : "";
            const firstImage =
                Array.isArray(p?.images) && p.images.length
                    ? String(p.images[0]).trim()
                    : "";
            const preview = thumb || firstImage;
            return {
                ...p,
                thumb: preview,
            };
        });

        const payload = {
            products: pageItems,
            page: safePage,
            perPage,
            totalPages,
            totalItems,
            hasNextPage: safePage < totalPages,
        };

        cacheManager.set("pages", cacheKey, payload);
        setCatalogCacheHeaders(res);
        return res.json(normalizeProductDescriptions(payload));
    }

    const pbUrl = String(process.env.PB_URL || "").trim();
    if (!pbUrl) {
        throw new Error("PB_URL is not configured");
    }

    const pbToken = String(process.env.PB_TOKEN || "").trim();
    const pbHeaders = { Accept: "application/json" };
    if (pbToken) {
        pbHeaders.Authorization = pbToken.includes(" ")
            ? pbToken
            : `Bearer ${pbToken}`;
    }

    let brandId = "";
    let categoryId = "";
    if (brand) {
        brandId = await resolveRelationIdByName({
            collection: "brands",
            name: brand,
            pbUrl,
            pbHeaders,
        });
    }
    if (category) {
        categoryId = await resolveRelationIdByName({
            collection: "categories",
            name: category,
            pbUrl,
            pbHeaders,
        });
    }

    if ((brand && !brandId) || (category && !categoryId)) {
        const payload = {
            products: [],
            page: 1,
            perPage,
            totalPages: 1,
            totalItems: 0,
            hasNextPage: false,
        };
        cacheManager.set("pages", cacheKey, payload);
        setCatalogCacheHeaders(res);
        return res.json(normalizeProductDescriptions(payload));
    }

    let filterParts = ['status = "active"'];

    if (brandId) {
        if (!isValidPocketBaseId(brandId)) {
            console.warn("Invalid brand ID format:", brandId);
            const payload = {
                products: [],
                page: 1,
                perPage,
                totalPages: 1,
                totalItems: 0,
                hasNextPage: false,
            };
            cacheManager.set("pages", cacheKey, payload);
            setCatalogCacheHeaders(res);
            return res.json(normalizeProductDescriptions(payload));
        }
        filterParts.push(`brand = "${brandId}"`);
    }

    if (categoryId) {
        if (!isValidPocketBaseId(categoryId)) {
            console.warn("Invalid category ID format:", categoryId);
            const payload = {
                products: [],
                page: 1,
                perPage,
                totalPages: 1,
                totalItems: 0,
                hasNextPage: false,
            };
            cacheManager.set("pages", cacheKey, payload);
            setCatalogCacheHeaders(res);
            return res.json(normalizeProductDescriptions(payload));
        }
        filterParts.push(`category = "${categoryId}"`);
    }

    const customFilter = filterParts.join(" && ");

    try {
        let totalItems = 0;
        let allIds = [];

        if (search || brand || category) {
            const idRecords = await loadProductIdsOnly(2000, customFilter);
            allIds = idRecords;

            if (search) {
                const q = search.toLowerCase();
                const tokens = q
                    .split(" ")
                    .map((t) => t.trim())
                    .filter(Boolean);
                if (tokens.length) {
                    allIds = idRecords.filter((p) => {
                        const title = String(
                            p?.title || p?.name || ""
                        ).toLowerCase();
                        const desc = String(p?.description || "").toLowerCase();
                        const hay = `${title} ${desc}`;
                        for (const tok of tokens) {
                            if (!hay.includes(tok)) return false;
                        }
                        return true;
                    });
                }
            }

            if (seed) {
                allIds.sort((a, b) => String(a.id).localeCompare(String(b.id)));
                allIds = shuffleDeterministic(allIds, seed);
            }

            totalItems = allIds.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
            const safePage = Math.min(page, totalPages);
            const start = (safePage - 1) * perPage;
            const end = start + perPage;
            const pageIds = allIds
                .slice(start, end)
                .map((x) => String(x?.id || "").trim())
                .filter(Boolean);

            const pageProducts = await loadProductsByIds(pageIds);
            let pageItems = pageProducts.map((p) => {
                const thumb =
                    typeof p?.thumb === "string" ? String(p.thumb).trim() : "";
                const firstImage =
                    Array.isArray(p?.images) && p.images.length
                        ? String(p.images[0]).trim()
                        : "";
                const preview = thumb || firstImage;
                return {
                    ...p,
                    thumb: preview,
                };
            });

            // Если есть категория или бренд, дополнительно перемешиваем результат для разнообразия,
            // но используем стабильный сид
            if (category || brand) {
                pageItems = shuffleDeterministic(pageItems, `${sessionSeed}:${category}:${brand}`);
            }

            const payload = {
                products: pageItems,
                page: safePage,
                perPage,
                totalPages,
                totalItems,
                hasNextPage: safePage < totalPages,
            };

            cacheManager.set("pages", cacheKey, payload);
            setCatalogCacheHeaders(res);
            return res.json(normalizeProductDescriptions(payload));
        }

        const pbResult = await listActiveProducts(page, perPage, customFilter);
        let products = pbResult.items;

        if (seed) {
            products = shuffleDeterministic(products, seed);
        }

        totalItems = pbResult.totalItems || products.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

        const pageItems = products.map((p) => {
            const thumb = typeof p?.thumb === "string" ? String(p.thumb).trim() : "";
            const firstImage =
                Array.isArray(p?.images) && p.images.length
                    ? String(p.images[0]).trim()
                    : "";
            const preview = thumb || firstImage;
            return {
                ...p,
                thumb: preview,
            };
        });

        const payload = {
            products: pageItems,
            page,
            perPage,
            totalPages,
            totalItems,
            hasNextPage: page < totalPages,
        };

        cacheManager.set("pages", cacheKey, payload);
        setCatalogCacheHeaders(res);
        return res.json(normalizeProductDescriptions(payload));
    } catch (err) {
        console.error("handleExternalProducts error:", err.message);
        throw err;
    }
}

async function listProducts(req, res) {
    try {
        const result = await listActiveProducts(1, 2000);
        const products = result.items;

        let filteredProducts = [...products];

        if (req.query.search) {
            const searchTerm = String(req.query.search).toLowerCase();
            filteredProducts = filteredProducts.filter(
                (p) =>
                    String(p.title || "")
                        .toLowerCase()
                        .includes(searchTerm) ||
                    String(p.description || "")
                        .toLowerCase()
                        .includes(searchTerm)
            );
        }

        if (req.query.category) {
            filteredProducts = filteredProducts.filter(
                (p) => String(p.category || "") === String(req.query.category)
            );
        }

        if (req.query.brand) {
            filteredProducts = filteredProducts.filter(
                (p) => String(p.brand || "") === String(req.query.brand)
            );
        }

        // Support legacy response format if needed or standard
        return res.json(
            filteredProducts.map((p) => ({
                ...p,
                product_id: String(p.product_id || p.id || "").trim(), // Legacy compat
                description: normalizeDescription(p?.description),
                photos: (Array.isArray(p.images) ? p.images : []).map((url) => ({
                    url,
                })),
                // Legacy fields
                season_title: String(p.season_title || p.brand || ""),
            }))
        );
    } catch (error) {
        return res
            .status(500)
            .json({ error: "Failed to load products", message: error?.message });
    }
}

async function getProductById(req, res) {
    try {
        const id = String(req.params.id || "").trim();
        const product = await getActiveProductById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        return res.json({
            ...product,
            description: normalizeDescription(product?.description),
            photos: (Array.isArray(product.images) ? product.images : []).map(
                (url) => ({ url })
            ),
        });
    } catch (error) {
        return res
            .status(500)
            .json({ error: "Failed to load product", message: error?.message });
    }
}

module.exports = {
    handleExternalProducts,
    listProducts,
    getProductById,
};
