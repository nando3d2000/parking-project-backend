import { User } from "../models/associations.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "parking_app_secret_key_2024";
const TOKEN_EXPIRATION = '24h';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
};

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRATION }
  );
};

const sendErrorResponse = (res, status, message, error = null) => {
  const response = { success: false, message };
  if (error) response.error = error.message;
  return res.status(status).json(response);
};

const sendSuccessResponse = (res, status, message, data = null) => {
  const response = { success: true, message };
  if (data) response.data = data;
  return res.status(status).json(response);
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El email ya está registrado");
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      phone
    });

    const token = generateToken(user);

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, "Usuario registrado exitosamente", {
      user: user.getPublicData(),
      token
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Email y contraseña son requeridos");
    }

    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, "Credenciales inválidas");
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, "Credenciales inválidas");
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "Login exitoso",
      data: { user: user.getPublicData(), token }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Usuario no encontrado");
    }

    return res.json({ success: true, data: user.getPublicData() });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, currentPassword, newPassword } = req.body;
    
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Usuario no encontrado");
    }

    if (newPassword) {
      if (!currentPassword) {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Contraseña actual requerida para cambiar contraseña");
      }

      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Contraseña actual incorrecta");
      }

      user.password = newPassword;
    }

    if (name) user.name = name;
    
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== user.id) {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El email ya está en uso");
      }
      user.email = email;
    }
    
    if (phone !== undefined) user.phone = phone;

    await user.save();

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Perfil actualizado exitosamente", user.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = role ? { role } : {};

    const users = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: {
        users: users.rows.map(user => user.getPublicData()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(users.count / limit),
          totalItems: users.count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Usuario no encontrado");
    }

    return res.json({ success: true, data: user.getPublicData() });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, phone } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Usuario no encontrado");
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== user.id) {
        return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El email ya está en uso");
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (phone !== undefined) updateData.phone = phone;

    await user.update(updateData);

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Usuario actualizado exitosamente", user.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (parseInt(id) === req.user.userId) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "No puedes eliminar tu propia cuenta");
    }
    
    const user = await User.findByPk(id);
    if (!user) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Usuario no encontrado");
    }

    await user.destroy();

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Usuario eliminado exitosamente");
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};