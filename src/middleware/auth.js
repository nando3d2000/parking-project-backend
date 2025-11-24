import jwt from "jsonwebtoken";
import { User } from "../models/associations.js";

const JWT_SECRET = process.env.JWT_SECRET || "parking_app_secret_key_2024";

// Middleware para verificar JWT token
export const authenticateToken = async (req, res, next) => {
    try {
        console.log('🔐 Middleware auth - Headers:', req.headers.authorization); // Debug
        
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            console.log('❌ No hay token en el header'); // Debug
            return res.status(401).json({
                success: false,
                message: "Token de acceso requerido"
            });
        }

        console.log('✅ Token encontrado, verificando...'); // Debug
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('✅ Token decodificado:', decoded); // Debug
        
        // Verificar que el usuario aún existe y está activo
        const user = await User.findOne({
            where: {
                id: decoded.userId,
                isActive: true
            }
        });

        if (!user) {
            console.log('❌ Usuario no encontrado o inactivo:', decoded.userId); // Debug
            return res.status(401).json({
                success: false,
                message: "Token inválido o usuario inactivo"
            });
        }

        console.log('✅ Usuario autenticado:', user.email); // Debug

        // Agregar información del usuario a la request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

        console.log('✅ req.user establecido:', req.user); // Debug
        next();

    } catch (error) {
        console.log('💥 Error en middleware auth:', error.message); // Debug
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Token expirado"
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Token inválido"
            });
        }

        console.error('Error en authenticateToken:', error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor"
        });
    }
};

// Middleware para verificar rol de administrador
export const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Se requieren permisos de administrador"
        });
    }
    next();
};

// Middleware para verificar que el usuario puede acceder al recurso
export const requireOwnershipOrAdmin = (userIdParam = 'id') => {
    return (req, res, next) => {
        const resourceUserId = parseInt(req.params[userIdParam]);
        const currentUserId = req.user.userId;
        const userRole = req.user.role;

        // Admin puede acceder a cualquier recurso
        // Usuario solo puede acceder a sus propios recursos
        if (userRole === 'admin' || resourceUserId === currentUserId) {
            next();
        } else {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a este recurso"
            });
        }
    };
};

// Middleware opcional para autenticación (si hay token lo verifica, si no, continúa)
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // Si no hay token, continuar sin autenticación
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findOne({
            where: {
                id: decoded.userId,
                isActive: true
            }
        });

        if (user) {
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role
            };
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // Si hay error en el token, continuar sin autenticación
        req.user = null;
        next();
    }
};

export default {
    authenticateToken,
    requireAdmin,
    requireOwnershipOrAdmin,
    optionalAuth
};