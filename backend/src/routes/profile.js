const express = require("express");
const router = express.Router();
const { asyncRoute } = require("../utils/apiHelpers");
const { handleGetProfileState, handleUpdateProfileState } = require("../handlers/profile");

// Standard API routes
router.get("/state", asyncRoute(handleGetProfileState));
router.post("/state", asyncRoute(handleUpdateProfileState));

// Aliases for compatibility
router.get("/", asyncRoute(handleGetProfileState));
router.post("/", asyncRoute(handleUpdateProfileState));

module.exports = router;
