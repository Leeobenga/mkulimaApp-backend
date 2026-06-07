import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { updateFarm } from "../controllers/farm.controller.js";

const router = express.Router();

router.patch("/:farmId", protect, updateFarm);

export default router;
