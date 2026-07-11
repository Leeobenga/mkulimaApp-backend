import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { getMe, updateMe, uploadPhoto, completeOnboarding } from "../controllers/user.controller.js";
import { uploadPhoto as uploadPhotoMiddleware } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.patch("/me/photo", protect, uploadPhotoMiddleware, uploadPhoto);
router.post("/onboarding/complete", protect, completeOnboarding);

export default router;
