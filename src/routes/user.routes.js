import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getMe, completeOnboarding } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", protect, getMe);
router.post("/onboarding/complete", protect, completeOnboarding);

export default router;
