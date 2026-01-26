const express = require("express");
const router = express.Router();
const { asyncRoute } = require("../utils/apiHelpers");
const { handleCatalogFilters } = require("../controllers/catalogController");
const {
    handleExternalProducts,
    listProducts,
    getProductById
} = require("../controllers/productController");

// The router is mounted with various prefixes in app.js
// We handle both flat and versioned paths here for maximum compatibility

// Catalog filters
router.get("/catalog-filters", asyncRoute(handleCatalogFilters));
router.get("/:version/:shop/catalog-filters", asyncRoute(handleCatalogFilters));

// External products (used by the main catalog)
router.get("/external-products", asyncRoute(handleExternalProducts));
router.get("/:version/:shop/external-products", asyncRoute(handleExternalProducts));

// Standard Product endpoints (CRUD-like)
router.get("/products", asyncRoute(listProducts));
router.get("/:version/:shop/products", asyncRoute(listProducts));

router.get("/products/:id", asyncRoute(getProductById));
router.get("/:version/:shop/products/:id", asyncRoute(getProductById));

module.exports = router;
