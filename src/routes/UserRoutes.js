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

// Rutas públicas (sin autenticación)
router.post("/register", register);
router.post("/login", login);

// Rutas protegidas (requieren autenticación)
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

// Rutas de administrador (requieren autenticación y rol admin)
router.get("/", authenticateToken, requireAdmin, getAllUsers);
router.get("/:id", authenticateToken, requireAdmin, getUserById);
router.put("/:id", authenticateToken, requireAdmin, updateUser);
router.delete("/:id", authenticateToken, requireAdmin, deleteUser);

export default router;