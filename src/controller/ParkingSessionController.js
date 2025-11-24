import { ParkingSession, ParkingSpot, ParkingLot, User } from "../models/associations.js";
import { Op } from "sequelize";

// Iniciar sesión de estacionamiento
export const startParkingSession = async (req, res) => {
    try {
        const { parkingSpotId } = req.body;
        const userId = req.user.id;
        
        // Verificar que el spot existe y está disponible
        const spot = await ParkingSpot.findByPk(parkingSpotId, {
            include: [
                {
                    model: ParkingLot,
                    as: 'parkingLot',
                    attributes: ['id', 'name', 'location']
                }
            ]
        });
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        // Verificar si el usuario puede usar este spot
        const canUseSpot = spot.status === 'available' || 
                          (spot.status === 'reserved' && spot.reservedById === userId);
        
        if (!canUseSpot) {
            return res.status(400).json({
                success: false,
                message: "El espacio no está disponible para usar"
            });
        }

        // Verificar que el usuario no tenga otra sesión activa
        const activeSession = await ParkingSession.findOne({
            where: { 
                userId, 
                endTime: null 
            }
        });

        if (activeSession) {
            return res.status(400).json({
                success: false,
                message: "Ya tienes una sesión de estacionamiento activa"
            });
        }

        // Crear la sesión
        const session = await ParkingSession.create({
            userId,
            parkingSpotId,
            startTime: new Date()
        });

        // Actualizar el estado del spot a ocupado
        await spot.update({ 
            status: 'occupied',
            reservedById: null // Limpiar reserva si la había
        });

        const sessionWithDetails = await ParkingSession.findByPk(session.id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: ParkingSpot,
                    as: 'parkingSpot',
                    attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
                    include: [
                        {
                            model: ParkingLot,
                            as: 'parkingLot',
                            attributes: ['id', 'name', 'location']
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: "Sesión de estacionamiento iniciada exitosamente",
            data: sessionWithDetails.getPublicData()
        });

    } catch (error) {
        console.error('Error en startParkingSession:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Finalizar sesión de estacionamiento
export const endParkingSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const session = await ParkingSession.findByPk(id, {
            include: [
                {
                    model: ParkingSpot,
                    as: 'parkingSpot',
                    attributes: ['id', 'code'],
                    include: [
                        {
                            model: ParkingLot,
                            as: 'parkingLot',
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                }
            ]
        });
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Sesión de estacionamiento no encontrada"
            });
        }

        if (session.endTime) {
            return res.status(400).json({
                success: false,
                message: "Esta sesión ya ha finalizado"
            });
        }

        // Solo el usuario dueño de la sesión o un admin puede finalizarla
        if (session.userId !== userId && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "No tienes permiso para finalizar esta sesión"
            });
        }

        // Finalizar la sesión
        await session.endSession();

        // Actualizar el estado del spot a disponible
        await ParkingSpot.update(
            { status: 'available' }, 
            { where: { id: session.parkingSpotId } }
        );

        // Recargar la sesión con los datos actualizados
        await session.reload();

        res.json({
            success: true,
            message: "Sesión de estacionamiento finalizada exitosamente",
            data: session.getPublicData()
        });

    } catch (error) {
        console.error('Error en endParkingSession:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener sesiones del usuario autenticado
export const getUserSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            status = 'all', // 'active', 'completed', 'all'
            page = 1, 
            limit = 10 
        } = req.query;
        
        const offset = (page - 1) * limit;
        const whereClause = { userId };
        
        if (status === 'active') {
            whereClause.endTime = null;
        } else if (status === 'completed') {
            whereClause.endTime = { [Op.not]: null };
        }

        const sessions = await ParkingSession.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: ParkingSpot,
                    as: 'parkingSpot',
                    attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
                    include: [
                        {
                            model: ParkingLot,
                            as: 'parkingLot',
                            attributes: ['id', 'name', 'location']
                        }
                    ]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['startTime', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                sessions: sessions.rows.map(session => session.getPublicData()),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(sessions.count / limit),
                    totalItems: sessions.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error en getUserSessions:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener todas las sesiones (solo admins)
export const getAllSessions = async (req, res) => {
    try {
        const { 
            status = 'all',
            parkingLotId,
            userId,
            startDate,
            endDate,
            page = 1, 
            limit = 10 
        } = req.query;
        
        const offset = (page - 1) * limit;
        const whereClause = {};
        
        // Filtros de estado
        if (status === 'active') {
            whereClause.endTime = null;
        } else if (status === 'completed') {
            whereClause.endTime = { [Op.not]: null };
        }

        // Filtro por usuario
        if (userId) {
            whereClause.userId = userId;
        }

        // Filtro por fechas
        if (startDate || endDate) {
            whereClause.startTime = {};
            if (startDate) {
                whereClause.startTime[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                whereClause.startTime[Op.lte] = new Date(endDate);
            }
        }

        const includeClause = [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
            },
            {
                model: ParkingSpot,
                as: 'parkingSpot',
                attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
                include: [
                    {
                        model: ParkingLot,
                        as: 'parkingLot',
                        attributes: ['id', 'name', 'location'],
                        where: parkingLotId ? { id: parkingLotId } : undefined
                    }
                ]
            }
        ];

        const sessions = await ParkingSession.findAndCountAll({
            where: whereClause,
            include: includeClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['startTime', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                sessions: sessions.rows.map(session => session.getPublicData()),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(sessions.count / limit),
                    totalItems: sessions.count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error en getAllSessions:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener sesión por ID
export const getSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const session = await ParkingSession.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: ParkingSpot,
                    as: 'parkingSpot',
                    attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
                    include: [
                        {
                            model: ParkingLot,
                            as: 'parkingLot',
                            attributes: ['id', 'name', 'location']
                        }
                    ]
                }
            ]
        });
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Sesión no encontrada"
            });
        }

        // Solo el usuario dueño de la sesión o un admin pueden ver los detalles
        if (session.userId !== userId && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "No tienes permiso para ver esta sesión"
            });
        }
        
        res.json({
            success: true,
            data: session.getPublicData()
        });

    } catch (error) {
        console.error('Error en getSessionById:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener sesión activa del usuario
export const getActiveSession = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const activeSession = await ParkingSession.findOne({
            where: { 
                userId, 
                endTime: null 
            },
            include: [
                {
                    model: ParkingSpot,
                    as: 'parkingSpot',
                    attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
                    include: [
                        {
                            model: ParkingLot,
                            as: 'parkingLot',
                            attributes: ['id', 'name', 'location']
                        }
                    ]
                }
            ]
        });
        
        if (!activeSession) {
            return res.json({
                success: true,
                data: null,
                message: "No tienes sesiones activas"
            });
        }
        
        res.json({
            success: true,
            data: activeSession.getPublicData()
        });

    } catch (error) {
        console.error('Error en getActiveSession:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Estadísticas de sesiones (solo admins)
export const getSessionStats = async (req, res) => {
    try {
        const { 
            parkingLotId,
            period = '7d' // 1d, 7d, 30d
        } = req.query;
        
        const periodMap = {
            '1d': 1,
            '7d': 7,
            '30d': 30
        };

        const days = periodMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const whereClause = {
            startTime: { [Op.gte]: startDate }
        };

        const includeClause = [];
        
        if (parkingLotId) {
            includeClause.push({
                model: ParkingSpot,
                as: 'parkingSpot',
                attributes: [],
                include: [
                    {
                        model: ParkingLot,
                        as: 'parkingLot',
                        attributes: [],
                        where: { id: parkingLotId }
                    }
                ]
            });
        }

        // Estadísticas básicas
        const [totalSessions, activeSessions, completedSessions] = await Promise.all([
            ParkingSession.count({ 
                where: whereClause,
                include: includeClause.length > 0 ? includeClause : undefined
            }),
            ParkingSession.count({ 
                where: { ...whereClause, endTime: null },
                include: includeClause.length > 0 ? includeClause : undefined
            }),
            ParkingSession.count({ 
                where: { ...whereClause, endTime: { [Op.not]: null } },
                include: includeClause.length > 0 ? includeClause : undefined
            })
        ]);

        // Duración promedio de sesiones completadas
        const completedSessionsWithDuration = await ParkingSession.findAll({
            where: { 
                ...whereClause, 
                endTime: { [Op.not]: null } 
            },
            include: includeClause.length > 0 ? includeClause : undefined,
            attributes: ['startTime', 'endTime']
        });

        const averageDuration = completedSessionsWithDuration.length > 0 
            ? completedSessionsWithDuration.reduce((sum, session) => {
                return sum + session.getDuration();
            }, 0) / completedSessionsWithDuration.length
            : 0;

        res.json({
            success: true,
            data: {
                period,
                parkingLotId: parkingLotId || 'all',
                totalSessions,
                activeSessions,
                completedSessions,
                averageDurationMinutes: Math.round(averageDuration),
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error en getSessionStats:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};