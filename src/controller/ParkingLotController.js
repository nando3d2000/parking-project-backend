import { ParkingLot, ParkingSpot } from "../models/associations.js";
import { Op } from "sequelize";

// Obtener todos los parking lots
export const getParkingLots = async (req, res) => {
    try {
        const { page = 1, limit = 10, isActive, search } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        
        // Filtrar por estado activo
        if (isActive !== undefined) {
            whereClause.isActive = isActive === 'true';
        }

        // Búsqueda por nombre o ubicación
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

        // Agregar estadísticas a cada parking lot
        const parkingLotsWithStats = parkingLots.rows.map(lot => {
            const spots = lot.parkingSpots || [];
            const stats = {
                total: spots.length,
                available: spots.filter(spot => spot.status === 'LIBRE').length,
                occupied: spots.filter(spot => spot.status === 'OCUPADO').length,
                reserved: spots.filter(spot => spot.status === 'RESERVADO').length,
                maintenance: spots.filter(spot => spot.status === 'MANTENIMIENTO').length
            };

            return {
                ...lot.getPublicData(),
                statistics: stats
            };
        });

        res.json({
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
        console.error('Error en getParkingLots:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener un parking lot por ID
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
            return res.status(404).json({
                success: false,
                message: "Estacionamiento no encontrado"
            });
        }

        // Calcular estadísticas
        const spots = parkingLot.parkingSpots || [];
        const stats = {
            total: spots.length,
            available: spots.filter(spot => spot.status === 'LIBRE').length,
            occupied: spots.filter(spot => spot.status === 'OCUPADO').length,
            reserved: spots.filter(spot => spot.status === 'RESERVADO').length,
            maintenance: spots.filter(spot => spot.status === 'MANTENIMIENTO').length,
            byFloor: {}
        };

        // Estadísticas por piso
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

        res.json({
            success: true,
            data: {
                ...parkingLot.getPublicData(),
                parkingSpots: spots,
                statistics: stats
            }
        });

    } catch (error) {
        console.error('Error en getParkingLotById:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Crear un nuevo parking lot (solo admins)
export const createParkingLot = async (req, res) => {
    try {
        const { name, location, description } = req.body;

        const parkingLot = await ParkingLot.create({
            name,
            location,
            description
            // totalSpots usará el valor por defecto (0) del modelo
        });

        res.status(201).json({
            success: true,
            message: "Estacionamiento creado exitosamente",
            data: parkingLot.getPublicData()
        });

    } catch (error) {
        console.error('Error en createParkingLot:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un estacionamiento con ese nombre"
            });
        }

        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Actualizar un parking lot (solo admins)
export const updateParkingLot = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, description, isActive } = req.body;
        
        const parkingLot = await ParkingLot.findByPk(id);
        
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "Estacionamiento no encontrado"
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (location !== undefined) updateData.location = location;
        if (description !== undefined) updateData.description = description;
        if (isActive !== undefined) updateData.isActive = isActive;

        // Recalcular totalSpots basado en ParkingSpots existentes
        const spotCount = await ParkingSpot.count({
            where: { parkingLotId: id }
        });
        updateData.totalSpots = spotCount;

        await parkingLot.update(updateData);

        res.json({
            success: true,
            message: "Estacionamiento actualizado exitosamente",
            data: parkingLot.getPublicData()
        });

    } catch (error) {
        console.error('Error en updateParkingLot:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un estacionamiento con ese nombre"
            });
        }

        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Eliminar un parking lot (solo admins)
export const deleteParkingLot = async (req, res) => {
    try {
        const { id } = req.params;
        
        const parkingLot = await ParkingLot.findByPk(id);
        
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "Estacionamiento no encontrado"
            });
        }

        // Verificar si tiene spots asociados
        const spotCount = await ParkingSpot.count({
            where: { parkingLotId: id }
        });

        if (spotCount > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el estacionamiento porque tiene ${spotCount} espacios asociados. Elimina los espacios primero.`
            });
        }

        await parkingLot.destroy();

        res.json({
            success: true,
            message: "Estacionamiento eliminado exitosamente"
        });

    } catch (error) {
        console.error('Error en deleteParkingLot:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener estadísticas generales de un parking lot
export const getParkingLotStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { period = '7d' } = req.query; // 1d, 7d, 30d
        
        const parkingLot = await ParkingLot.findByPk(id);
        
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "Estacionamiento no encontrado"
            });
        }

        // Estadísticas básicas de espacios
        const spots = await ParkingSpot.findAll({
            where: { parkingLotId: id },
            attributes: ['id', 'status', 'floor', 'spotType']
        });

        const basicStats = {
            total: spots.length,
            available: spots.filter(spot => spot.status === 'available').length,
            occupied: spots.filter(spot => spot.status === 'occupied').length,
            reserved: spots.filter(spot => spot.status === 'reserved').length,
            maintenance: spots.filter(spot => spot.status === 'maintenance').length,
            disabled: spots.filter(spot => spot.status === 'disabled').length,
            occupancyRate: spots.length > 0 ? ((spots.filter(spot => spot.status === 'occupied').length / spots.length) * 100).toFixed(2) : 0
        };

        // Estadísticas por tipo de espacio
        const spotTypeStats = {};
        spots.forEach(spot => {
            if (!spotTypeStats[spot.spotType]) {
                spotTypeStats[spot.spotType] = { total: 0, available: 0, occupied: 0 };
            }
            spotTypeStats[spot.spotType].total++;
            if (spot.status === 'LIBRE') spotTypeStats[spot.spotType].available++;
            if (spot.status === 'OCUPADO') spotTypeStats[spot.spotType].occupied++;
        });

        // Como ya no tenemos pisos, podemos eliminar esta sección
        // Estadísticas simplificadas
        const overallStats = {
            total: spots.length,
            available: spots.filter(spot => spot.status === 'LIBRE').length,
            occupied: spots.filter(spot => spot.status === 'OCUPADO').length,
            reserved: spots.filter(spot => spot.status === 'RESERVADO').length,
            maintenance: spots.filter(spot => spot.status === 'MANTENIMIENTO').length
        };

        res.json({
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
        console.error('Error en getParkingLotStats:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener parking spots de un parking lot específico
export const getParkingLotSpots = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, floor } = req.query;

        // Verificar que el parking lot existe
        const parkingLot = await ParkingLot.findByPk(id);
        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "Parking lot no encontrado"
            });
        }

        // Construir filtros
        const whereClause = {
            parkingLotId: id
        };

        if (status) {
            whereClause.status = status;
        }

        if (floor) {
            whereClause.floor = floor;
        }

        // Obtener spots con filtros
        const parkingSpots = await ParkingSpot.findAll({
            where: whereClause,
            include: [{
                model: ParkingLot,
                as: 'parkingLot',
                attributes: ['id', 'name', 'location']
            }],
            order: [['code', 'ASC']]
        });

        console.log('📍 Spots encontrados:', parkingSpots.length);
        if (parkingSpots.length > 0) {
            console.log('📊 Primer spot - Estado original:', parkingSpots[0].status);
            console.log('📊 Todos los estados únicos:', [...new Set(parkingSpots.map(s => s.status))]);
        }

        // Formatear respuesta
        const formattedSpots = parkingSpots.map(spot => {
            // Mapear estados de la BD al formato esperado por el frontend
            let mappedStatus;
            switch(spot.status) {
                case 'LIBRE':
                    mappedStatus = 'available';
                    break;
                case 'OCUPADO':
                    mappedStatus = 'occupied';
                    break;
                case 'RESERVADO':
                    mappedStatus = 'reserved';
                    break;
                case 'MANTENIMIENTO':
                    mappedStatus = 'maintenance';
                    break;
                default:
                    mappedStatus = 'available'; // valor por defecto
            }

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

        console.log('🔄 Estados después del mapeo:', [...new Set(formattedSpots.map(s => s.status))]);
        console.log('📊 Ejemplo de spot mapeado:', formattedSpots[0]);

        res.json({
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
        console.error('Error en getParkingLotSpots:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};