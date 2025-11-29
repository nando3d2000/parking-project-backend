import jwt from "jsonwebtoken";
import { User } from "../models/associations.js";

const JWT_SECRET = process.env.JWT_SECRET || "parking_app_secret_key_2024";

const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500
};

const extractTokenFromHeader = (authHeader) => {
  return authHeader?.split(' ')[1];
};

const sendUnauthorizedResponse = (res, message) => {
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message });
};

const sendForbiddenResponse = (res, message) => {
  return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message });
};

const sendInternalErrorResponse = (res, message) => {
  return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message });
};

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return sendUnauthorizedResponse(res, "Token de acceso requerido");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true
      }
    });

    if (!user) {
      return sendUnauthorizedResponse(res, "Token inválido o usuario inactivo");
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendUnauthorizedResponse(res, "Token expirado");
    }
    
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorizedResponse(res, "Token inválido");
    }

    return sendInternalErrorResponse(res, "Error interno del servidor");
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return sendForbiddenResponse(res, "Se requieren permisos de administrador");
  }
  next();
};

export const requireOwnershipOrAdmin = (userIdParam = 'id') => {
  return (req, res, next) => {
    const resourceUserId = parseInt(req.params[userIdParam]);
    const currentUserId = req.user.userId;
    const userRole = req.user.role;

    if (userRole === 'admin' || resourceUserId === currentUserId) {
      next();
    } else {
      return sendForbiddenResponse(res, "No tienes permisos para acceder a este recurso");
    }
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
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