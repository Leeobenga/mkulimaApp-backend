import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getMyWeather } from "../controllers/weather.controller.js";

const router = express.Router();

router.get("/me", protect, getMyWeather);

export default router;
