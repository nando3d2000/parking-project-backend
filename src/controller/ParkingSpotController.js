import { ParkingSpot, ParkingLot, User, ParkingSession } from "../models/associations.js";
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

const VALID_SPOT_TYPES = ['car', 'motorcycle'];
const VALID_STATUSES = ['LIBRE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO'];
const VALID_TRANSITIONS = {
  'LIBRE': ['OCUPADO', 'RESERVADO', 'MANTENIMIENTO'],
  'OCUPADO': ['LIBRE', 'MANTENIMIENTO'],
  'RESERVADO': ['OCUPADO', 'LIBRE'],
  'MANTENIMIENTO': ['LIBRE']
};

export const getParkingSpots = async (req, res) => {
  try {
    const { parkingLotId, status, spotType, isActive, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const whereClause = {};
    
    if (parkingLotId) whereClause.parkingLotId = parkingLotId;
    if (status) whereClause.status = status;
    if (spotType) whereClause.spotType = spotType;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const parkingSpots = await ParkingSpot.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['code', 'ASC']]
    });

    return res.json({
      success: true,
      data: {
        parkingSpots: parkingSpots.rows.map(spot => spot.getPublicData()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(parkingSpots.count / limit),
          totalItems: parkingSpots.count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const createParkingSpot = async (req, res) => {
  try {
    const { spotType, parkingLotId } = req.body;

    if (!spotType || !parkingLotId) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Tipo de spot y parking lot son requeridos");
    }

    if (!VALID_SPOT_TYPES.includes(spotType)) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El tipo de spot debe ser 'car' o 'motorcycle'");
    }

    const parkingLot = await ParkingLot.findByPk(parkingLotId);
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento no encontrado");
    }

    const newParkingSpot = await ParkingSpot.create({
      spotType,
      parkingLotId,
      createdBy: req.user.userId || 1,
      status: 'LIBRE'
    });

    await newParkingSpot.reload();

    const totalSpots = await ParkingSpot.count({ where: { parkingLotId, isActive: true } });
    await parkingLot.update({ totalSpots });

    const spotWithRelations = await ParkingSpot.findByPk(newParkingSpot.id, {
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }]
    });

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, "Espacio de estacionamiento creado exitosamente", spotWithRelations.getPublicData());
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Ya existe un espacio con ese código en este estacionamiento");
    }
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getParkingSpotById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const spot = await ParkingSpot.findByPk(id, {
      include: [
        {
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });
    
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }
    
    return res.json({ success: true, data: spot.getPublicData() });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const updateParkingSpotStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const spot = await ParkingSpot.findByPk(id);
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    if (!VALID_STATUSES.includes(status)) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, `Estado inválido. Los estados válidos son: ${VALID_STATUSES.join(', ')}`);
    }

    if (!VALID_TRANSITIONS[spot.status]?.includes(status)) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, `No se puede cambiar el estado de ${spot.status} a ${status}`);
    }

    await spot.update({ status });
    
    const updatedSpot = await ParkingSpot.findByPk(id, {
      include: [
        {
          model: ParkingLot,
          as: 'parkingLot',
          attributes: ['id', 'name', 'location']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Estado actualizado exitosamente", updatedSpot.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const updateParkingSpot = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, parkingLotId, floor, zone, spotType, description, isActive } = req.body;
    
    const spot = await ParkingSpot.findByPk(id);
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    if (parkingLotId && parkingLotId !== spot.parkingLotId) {
      const parkingLot = await ParkingLot.findByPk(parkingLotId);
      if (!parkingLot) {
        return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento destino no encontrado");
      }
    }

    const updateData = {};
    if (code !== undefined) updateData.code = code;
    if (parkingLotId !== undefined) updateData.parkingLotId = parkingLotId;
    if (floor !== undefined) updateData.floor = floor;
    if (zone !== undefined) updateData.zone = zone;
    if (spotType !== undefined) updateData.spotType = spotType;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    await spot.update(updateData);

    const affectedLots = [spot.parkingLotId];
    if (parkingLotId && parkingLotId !== spot.parkingLotId) {
      affectedLots.push(parkingLotId);
    }

    for (const lotId of affectedLots) {
      const totalSpots = await ParkingSpot.count({ where: { parkingLotId: lotId, isActive: true } });
      await ParkingLot.update({ totalSpots }, { where: { id: lotId } });
    }

    const updatedSpot = await ParkingSpot.findByPk(id, {
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }]
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Espacio actualizado exitosamente", updatedSpot.getPublicData());
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Ya existe un espacio con ese código en este estacionamiento");
    }
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const deleteParkingSpot = async (req, res) => {
  try {
    const { id } = req.params;
    
    const spot = await ParkingSpot.findByPk(id);
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    const activeSessions = await ParkingSession.count({
      where: { parkingSpotId: id, endTime: null }
    });

    if (activeSessions > 0) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "No se puede eliminar el espacio porque tiene sesiones activas");
    }

    const parkingLotId = spot.parkingLotId;
    await spot.destroy();

    const totalSpots = await ParkingSpot.count({ where: { parkingLotId, isActive: true } });
    await ParkingLot.update({ totalSpots }, { where: { id: parkingLotId } });

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Espacio eliminado exitosamente");
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const reserveParkingSpot = async (req, res) => {
  try {
    const { id } = req.params;
    
    const spot = await ParkingSpot.findByPk(id);
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    if (spot.status !== 'available') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "El espacio no está disponible para reserva");
    }

    await spot.update({ status: 'RESERVADO' });

    const updatedSpot = await ParkingSpot.findByPk(id, {
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }]
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Espacio reservado exitosamente", updatedSpot.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const spot = await ParkingSpot.findByPk(id);
    if (!spot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Espacio de estacionamiento no encontrado");
    }

    if (spot.status !== 'RESERVADO') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Este espacio no está reservado");
    }

    await spot.update({ status: 'LIBRE' });

    const updatedSpot = await ParkingSpot.findByPk(id, {
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }]
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Reserva cancelada exitosamente", updatedSpot.getPublicData());
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};