import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
    getCurrentCropIntelligence,
    getCropIntelligence,
    getCropIntelligenceHistory
} from "../controllers/crop.controller.js";

const router = express.Router();

router.get("/intelligence/history", protect, getCropIntelligenceHistory);
router.get("/intelligence/current", protect, getCurrentCropIntelligence);
router.post("/intelligence", protect, getCropIntelligence);

export default router;
