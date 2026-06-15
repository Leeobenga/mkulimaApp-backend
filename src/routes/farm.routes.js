import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { updateFarm, addCrop } from "../controllers/farm.controller.js";

const router = express.Router();

router.patch("/:farmId", protect, updateFarm);
router.post("/:farmId/crops", protect, addCrop);

export default router;
