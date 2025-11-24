import { User } from "../models/associations.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Clave secreta para JWT (en producción debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || "parking_app_secret_key_2024";

// Registrar nuevo usuario
export const register = async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "El email ya está registrado"
            });
        }

        // Crear el nuevo usuario (la contraseña se hasheará automáticamente)
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'user',
            phone
        });

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: "Usuario registrado exitosamente",
            data: {
                user: user.getPublicData(),
                token
            }
        });

    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Login de usuario
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email y contraseña son requeridos"
            });
        }

        // Buscar usuario por email
        const user = await User.findOne({ 
            where: { 
                email,
                isActive: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Credenciales inválidas"
            });
        }

        // Verificar contraseña
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Credenciales inválidas"
            });
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: "Login exitoso",
            data: {
                user: user.getPublicData(),
                token
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener perfil del usuario actual
export const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        res.json({
            success: true,
            data: user.getPublicData()
        });

    } catch (error) {
        console.error('Error en getProfile:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Actualizar perfil del usuario
export const updateProfile = async (req, res) => {
    try {
        const { name, email, phone, currentPassword, newPassword } = req.body;
        
        const user = await User.findByPk(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        // Si se quiere cambiar la contraseña, validar la actual
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Contraseña actual requerida para cambiar contraseña"
                });
            }

            const isValidPassword = await user.validatePassword(currentPassword);
            if (!isValidPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Contraseña actual incorrecta"
                });
            }

            user.password = newPassword;
        }

        // Actualizar otros campos
        if (name) user.name = name;
        if (email && email !== user.email) {
            // Verificar que el email no esté en uso
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser && existingUser.id !== user.id) {
                return res.status(400).json({
                    success: false,
                    message: "El email ya está en uso"
                });
            }
            user.email = email;
        }
        if (phone !== undefined) user.phone = phone;

        await user.save();

        res.json({
            success: true,
            message: "Perfil actualizado exitosamente",
            data: user.getPublicData()
        });

    } catch (error) {
        console.error('Error en updateProfile:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener todos los usuarios (solo para admins)
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (role) {
            whereClause.role = role;
        }

        const users = await User.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
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
        console.error('Error en getAllUsers:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener usuario por ID (solo para admins)
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        res.json({
            success: true,
            data: user.getPublicData()
        });

    } catch (error) {
        console.error('Error en getUserById:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Actualizar usuario por ID (solo para admins)
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, isActive, phone } = req.body;
        
        const user = await User.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        // Verificar que el email no esté en uso
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser && existingUser.id !== user.id) {
                return res.status(400).json({
                    success: false,
                    message: "El email ya está en uso"
                });
            }
        }

        // Actualizar campos
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (phone !== undefined) updateData.phone = phone;

        await user.update(updateData);

        res.json({
            success: true,
            message: "Usuario actualizado exitosamente",
            data: user.getPublicData()
        });

    } catch (error) {
        console.error('Error en updateUser:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Eliminar usuario (solo para admins)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir eliminar el propio usuario
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({
                success: false,
                message: "No puedes eliminar tu propia cuenta"
            });
        }
        
        const user = await User.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        await user.destroy();

        res.json({
            success: true,
            message: "Usuario eliminado exitosamente"
        });

    } catch (error) {
        console.error('Error en deleteUser:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};