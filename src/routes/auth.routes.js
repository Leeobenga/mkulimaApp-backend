import express from "express";
import { register, login, refresh, logout, verifyEmail, verifyPhone, changePassword, requestEmailVerification, requestPhoneVerification } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";


const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Verification endpoints
router.post("/request-email-verification", protect, requestEmailVerification);
router.post("/request-phone-verification", protect, requestPhoneVerification);
router.post("/verify-email", verifyEmail);
router.post("/verify-phone", verifyPhone);

// Change password (authenticated)
router.post("/change-password", protect, changePassword);

export default router;
