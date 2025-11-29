import { Router } from "express";
import {
    register,
    login,
    getProfile,
    updateProfile,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
} from "../controller/UserController.js";
import { 
    authenticateToken, 
    requireAdmin,
    requireOwnershipOrAdmin
} from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

router.get("/", authenticateToken, requireAdmin, getAllUsers);
router.get("/:id", authenticateToken, requireAdmin, getUserById);
router.put("/:id", authenticateToken, requireAdmin, updateUser);
router.delete("/:id", authenticateToken, requireAdmin, deleteUser);

export default router;