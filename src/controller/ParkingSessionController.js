import { ParkingSession, ParkingSpot, ParkingLot, User } from "../models/associations.js";
import { Op } from "sequelize";

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
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

export const startParkingSession = async (req, res) => {
  try {
    const { parkingSpotId } = req.body;
    const userId = req.user.id;
    
    const spot = await ParkingSpot.findByPk(parkingSpotId, {
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }]
    });
    
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    const canUseSpot = spot.status === 'available' || 
                      (spot.status === 'reserved' && spot.reservedById === userId);
    
    if (!canUseSpot) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El espacio no está disponible para usar");
    }

    const activeSession = await ParkingSession.findOne({
      where: { userId, endTime: null }
    });

    if (activeSession) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Ya tienes una sesión de estacionamiento activa");
    }

    const session = await ParkingSession.create({
      userId,
      parkingSpotId,
      startTime: new Date()
    });

    await spot.update({ 
      status: 'occupied',
      reservedById: null
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
          include: [{
            model: ParkingLot,
            as: 'parkingLot',
            attributes: ['id', 'name', 'location']
          }]
        }
      ]
    });

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, "Sesión de estacionamiento iniciada exitosamente", sessionWithDetails.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

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
          include: [{
            model: ParkingLot,
            as: 'parkingLot',
            attributes: ['id', 'name']
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    if (!session) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Sesión de estacionamiento no encontrada");
    }

    if (session.endTime) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Esta sesión ya ha finalizado");
    }

    if (session.userId !== userId && userRole !== 'admin') {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "No tienes permiso para finalizar esta sesión");
    }

    await session.endSession();
    await ParkingSpot.update({ status: 'available' }, { where: { id: session.parkingSpotId } });
    await session.reload();

    return res.json({
      success: true,
      message: "Sesión de estacionamiento finalizada exitosamente",
      data: session.getPublicData()
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'all', page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = { userId };
    
    if (status === 'active') {
      whereClause.endTime = null;
    } else if (status === 'completed') {
      whereClause.endTime = { [Op.not]: null };
    }

    const sessions = await ParkingSession.findAndCountAll({
      where: whereClause,
      include: [{
        model: ParkingSpot,
        as: 'parkingSpot',
        attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
        include: [{
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location']
        }]
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['startTime', 'DESC']]
    });

    return res.json({
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
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

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
    
    if (status === 'active') {
      whereClause.endTime = null;
    } else if (status === 'completed') {
      whereClause.endTime = { [Op.not]: null };
    }

    if (userId) {
      whereClause.userId = userId;
    }

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
        include: [{
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location'],
          where: parkingLotId ? { id: parkingLotId } : undefined
        }]
      }
    ];

    const sessions = await ParkingSession.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['startTime', 'DESC']]
    });

    return res.json({
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
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

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
          include: [{
            model: ParkingLot,
            as: 'parkingLot',
            attributes: ['id', 'name', 'location']
          }]
        }
      ]
    });
    
    if (!session) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Sesión no encontrada");
    }

    if (session.userId !== userId && userRole !== 'admin') {
      return sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, "No tienes permiso para ver esta sesión");
    }
    
    return res.json({ success: true, data: session.getPublicData() });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getActiveSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const activeSession = await ParkingSession.findOne({
      where: { userId, endTime: null },
      include: [{
        model: ParkingSpot,
        as: 'parkingSpot',
        attributes: ['id', 'code', 'floor', 'zone', 'spotType'],
        include: [{
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location']
        }]
      }]
    });
    
    if (!activeSession) {
      return res.json({
        success: true,
        data: null,
        message: "No tienes sesiones activas"
      });
    }
    
    return res.json({ success: true, data: activeSession.getPublicData() });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getSessionStats = async (req, res) => {
  try {
    const { parkingLotId, period = '7d' } = req.query;
    
    const periodMap = { '1d': 1, '7d': 7, '30d': 30 };
    const days = periodMap[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = { startTime: { [Op.gte]: startDate } };
    const includeClause = [];
    
    if (parkingLotId) {
      includeClause.push({
        model: ParkingSpot,
        as: 'parkingSpot',
        attributes: [],
        include: [{
          model: ParkingLot,
          as: 'parkingLot',
          attributes: [],
          where: { id: parkingLotId }
        }]
      });
    }

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

    const completedSessionsWithDuration = await ParkingSession.findAll({
      where: { ...whereClause, endTime: { [Op.not]: null } },
      include: includeClause.length > 0 ? includeClause : undefined,
      attributes: ['startTime', 'endTime']
    });

    const averageDuration = completedSessionsWithDuration.length > 0 
      ? completedSessionsWithDuration.reduce((sum, session) => sum + session.getDuration(), 0) / completedSessionsWithDuration.length
      : 0;

    return res.json({
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
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};