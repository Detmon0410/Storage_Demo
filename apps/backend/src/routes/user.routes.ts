import { Router } from "express";
import { assignUserRoles, createUser, deactivateUser, getUser, listUsers, reactivateUser, updateUser } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const userRoutes = Router();

userRoutes.get("/", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), listUsers);
userRoutes.get("/:id", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), getUser);
userRoutes.post("/", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), createUser);
userRoutes.put("/:id", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), updateUser);
userRoutes.post("/:id/deactivate", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), deactivateUser);
userRoutes.post("/:id/reactivate", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), reactivateUser);
userRoutes.put("/:id/roles", requireAuth, requirePermission("USER_MANAGEMENT_FULL"), assignUserRoles);
