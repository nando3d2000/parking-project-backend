import { ParkingLot, ParkingSpot } from "../models/associations.js";
import { Op } from "sequelize";

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
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

const calculateParkingLotStats = (spots) => {
  return {
    total: spots.length,
    available: spots.filter(spot => spot.status === 'LIBRE').length,
    occupied: spots.filter(spot => spot.status === 'OCUPADO').length,
    reserved: spots.filter(spot => spot.status === 'RESERVADO').length,
    maintenance: spots.filter(spot => spot.status === 'MANTENIMIENTO').length
  };
};

export const getParkingLots = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }

    const parkingLots = await ParkingLot.findAndCountAll({
      where: whereClause,
      include: [{
        model: ParkingSpot,
        as: 'parkingSpots',
        attributes: ['id', 'status'],
        required: false
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const parkingLotsWithStats = parkingLots.rows.map(lot => {
      const spots = lot.parkingSpots || [];
      return {
        ...lot.getPublicData(),
        statistics: calculateParkingLotStats(spots)
      };
    });

    return res.json({
      success: true,
      data: {
        parkingLots: parkingLotsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(parkingLots.count / limit),
          totalItems: parkingLots.count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getParkingLotById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const parkingLot = await ParkingLot.findByPk(id, {
      include: [{
        model: ParkingSpot,
        as: 'parkingSpots',
        attributes: ['id', 'code', 'status', 'floor', 'zone', 'spotType', 'isActive'],
        required: false
      }]
    });
    
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento no encontrado");
    }

    const spots = parkingLot.parkingSpots || [];
    const stats = {
      ...calculateParkingLotStats(spots),
      byFloor: {}
    };

    spots.forEach(spot => {
      if (!stats.byFloor[spot.floor]) {
        stats.byFloor[spot.floor] = {
          total: 0,
          available: 0,
          occupied: 0,
          reserved: 0,
          maintenance: 0,
          disabled: 0
        };
      }
      stats.byFloor[spot.floor].total++;
      stats.byFloor[spot.floor][spot.status]++;
    });

    return res.json({
      success: true,
      data: {
        ...parkingLot.getPublicData(),
        parkingSpots: spots,
        statistics: stats
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const createParkingLot = async (req, res) => {
  try {
    const { name, location, description } = req.body;

    const parkingLot = await ParkingLot.create({ name, location, description });

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, "Estacionamiento creado exitosamente", parkingLot.getPublicData());
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Ya existe un estacionamiento con ese nombre");
    }
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const updateParkingLot = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, description, isActive } = req.body;
    
    const parkingLot = await ParkingLot.findByPk(id);
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento no encontrado");
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const spotCount = await ParkingSpot.count({ where: { parkingLotId: id } });
    updateData.totalSpots = spotCount;

    await parkingLot.update(updateData);

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Estacionamiento actualizado exitosamente", parkingLot.getPublicData());
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, "Ya existe un estacionamiento con ese nombre");
    }
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const deleteParkingLot = async (req, res) => {
  try {
    const { id } = req.params;
    
    const parkingLot = await ParkingLot.findByPk(id);
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento no encontrado");
    }

    const spotCount = await ParkingSpot.count({ where: { parkingLotId: id } });
    if (spotCount > 0) {
      return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, `No se puede eliminar el estacionamiento porque tiene ${spotCount} espacios asociados. Elimina los espacios primero.`);
    }

    await parkingLot.destroy();

    return sendSuccessResponse(res, HTTP_STATUS.OK, "Estacionamiento eliminado exitosamente");
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getParkingLotStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '7d' } = req.query;
    
    const parkingLot = await ParkingLot.findByPk(id);
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Estacionamiento no encontrado");
    }

    const spots = await ParkingSpot.findAll({
      where: { parkingLotId: id },
      attributes: ['id', 'status', 'floor', 'spotType']
    });

    const overallStats = calculateParkingLotStats(spots);

    const spotTypeStats = {};
    spots.forEach(spot => {
      if (!spotTypeStats[spot.spotType]) {
        spotTypeStats[spot.spotType] = { total: 0, available: 0, occupied: 0 };
      }
      spotTypeStats[spot.spotType].total++;
      if (spot.status === 'LIBRE') spotTypeStats[spot.spotType].available++;
      if (spot.status === 'OCUPADO') spotTypeStats[spot.spotType].occupied++;
    });

    return res.json({
      success: true,
      data: {
        parkingLot: parkingLot.getPublicData(),
        period,
        basicStats: overallStats,
        spotTypeStats,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};

export const getParkingLotSpots = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, floor } = req.query;

    const parkingLot = await ParkingLot.findByPk(id);
    if (!parkingLot) {
      return sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, "Parking lot no encontrado");
    }

    const whereClause = { parkingLotId: id };
    if (status) whereClause.status = status;
    if (floor) whereClause.floor = floor;

    const parkingSpots = await ParkingSpot.findAll({
      where: whereClause,
      include: [{
        model: ParkingLot,
        as: 'parkingLot',
        attributes: ['id', 'name', 'location']
      }],
      order: [['code', 'ASC']]
    });

    const formattedSpots = parkingSpots.map(spot => {
      const statusMap = {
        'LIBRE': 'available',
        'OCUPADO': 'occupied',
        'RESERVADO': 'reserved',
        'MANTENIMIENTO': 'maintenance'
      };
      const mappedStatus = statusMap[spot.status] || 'available';

      return {
        id: spot.id,
        code: spot.code,
        status: mappedStatus,
        floor: spot.floor || 1,
        spotType: spot.spotType || 'REGULAR',
        parkingLotId: spot.parkingLotId,
        parkingLot: spot.parkingLot ? {
          id: spot.parkingLot.id,
          name: spot.parkingLot.name,
          location: spot.parkingLot.location
        } : null
      };
    });

    return res.json({
      success: true,
      message: "Parking spots obtenidos exitosamente",
      data: {
        parkingLot: {
          id: parkingLot.id,
          name: parkingLot.name,
          location: parkingLot.location
        },
        parkingSpots: formattedSpots,
        total: formattedSpots.length
      }
    });
  } catch (error) {
    return sendErrorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Error interno del servidor", error);
  }
};