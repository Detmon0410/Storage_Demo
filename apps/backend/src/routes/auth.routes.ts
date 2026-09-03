import { Router } from "express";
import { login, logout, refresh } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimiter, login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", requireAuth, logout);
