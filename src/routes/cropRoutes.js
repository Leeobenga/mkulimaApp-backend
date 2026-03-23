import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getCropIntelligence } from "../controllers/crop.controller.js";

const router = express.Router();

router.post("/intelligence", protect, getCropIntelligence);

export default router;
