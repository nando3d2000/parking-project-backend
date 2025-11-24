import { ParkingSpot, ParkingLot, User, ParkingSession } from "../models/associations.js";
import { Op } from "sequelize";

// Obtener todos los parking spots con filtros
export const getParkingSpots = async (req, res) => {
    try {
        console.log('📋 getParkingSpots - Query params:', req.query); // Debug
        
        const { 
            parkingLotId, 
            status, 
            spotType,
            isActive,
            page = 1, 
            limit = 10 
        } = req.query;
        
        const offset = (page - 1) * limit;
        const whereClause = {};
        
        // Filtros
        if (parkingLotId) {
            whereClause.parkingLotId = parkingLotId;
            console.log('🔍 Filtrando por parkingLotId:', parkingLotId); // Debug
        }
        if (status) whereClause.status = status;
        if (spotType) whereClause.spotType = spotType;
        if (isActive !== undefined) whereClause.isActive = isActive === 'true';

        console.log('🔍 Where clause:', whereClause); // Debug

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

        console.log('✅ Spots encontrados:', parkingSpots.count); // Debug
        console.log('📋 Primer spot (si existe):', parkingSpots.rows[0]?.dataValues); // Debug

        res.json({
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
        console.error('Error en getParkingSpots:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Crear parking spot (solo admins)
export const createParkingSpot = async (req, res) => {
    try {
        console.log('📝 Datos recibidos en createParkingSpot:', req.body); // Debug
        console.log('👤 Usuario autenticado:', req.user); // Debug
        
        const { 
            spotType,
            parkingLotId
        } = req.body;

        // Validaciones
        if (!spotType || !parkingLotId) {
            console.log('❌ Faltan datos requeridos'); // Debug
            return res.status(400).json({
                success: false,
                message: "Tipo de spot y parking lot son requeridos"
            });
        }

        // Validar tipos permitidos
        if (!['car', 'motorcycle'].includes(spotType)) {
            return res.status(400).json({
                success: false,
                message: "El tipo de spot debe ser 'car' o 'motorcycle'"
            });
        }

        // Verificar que existe el parking lot
        const parkingLot = await ParkingLot.findByPk(parkingLotId);
        if (!parkingLot) {
            console.log('❌ Parking lot no encontrado:', parkingLotId); // Debug
            return res.status(404).json({
                success: false,
                message: "Estacionamiento no encontrado"
            });
        }

        console.log('✅ Creando nuevo spot...'); // Debug
        const newParkingSpot = await ParkingSpot.create({
            spotType,
            parkingLotId,
            createdBy: req.user.userId || 1, // Fallback al admin
            status: 'LIBRE'
            // El código se generará automáticamente via hooks
        });

        console.log('✅ Spot creado:', newParkingSpot.toJSON()); // Debug

        // Recargar el spot para obtener el código final
        await newParkingSpot.reload();
        console.log('✅ Spot después de reload:', newParkingSpot.toJSON()); // Debug

        // Actualizar el total de spots en el parking lot
        const totalSpots = await ParkingSpot.count({ 
            where: { parkingLotId, isActive: true } 
        });
        await parkingLot.update({ totalSpots });

        const spotWithRelations = await ParkingSpot.findByPk(newParkingSpot.id, {
            include: [
                {
                    model: ParkingLot,
                    as: 'parkingLot',
                    attributes: ['id', 'name', 'location']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: "Espacio de estacionamiento creado exitosamente",
            data: spotWithRelations.getPublicData()
        });

    } catch (error) {
        console.error('💥 Error completo en createParkingSpot:', error); // Debug mejorado
        console.error('📋 Stack trace:', error.stack); // Debug stack
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un espacio con ese código en este estacionamiento"
            });
        }
        
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener parking spot por ID
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
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }
        
        res.json({
            success: true,
            data: spot.getPublicData()
        });

    } catch (error) {
        console.error('Error en getParkingSpotById:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Actualizar solo el estado del parking spot
export const updateParkingSpotStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;
        
        const spot = await ParkingSpot.findByPk(id);
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        // Validar los estados permitidos
        const validStatuses = ['LIBRE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Estado inválido. Los estados válidos son: ${validStatuses.join(', ')}`
            });
        }

        // Validar transiciones de estado
        const validTransitions = {
            'LIBRE': ['OCUPADO', 'RESERVADO', 'MANTENIMIENTO'],
            'OCUPADO': ['LIBRE', 'MANTENIMIENTO'],
            'RESERVADO': ['OCUPADO', 'LIBRE'],
            'MANTENIMIENTO': ['LIBRE']
        };

        if (!validTransitions[spot.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `No se puede cambiar el estado de ${spot.status} a ${status}`
            });
        }

        const updateData = { status };
        
        await spot.update(updateData);
        
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

        res.json({
            success: true,
            message: "Estado actualizado exitosamente",
            data: updatedSpot.getPublicData()
        });

    } catch (error) {
        console.error('Error en updateParkingSpotStatus:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Actualizar parking spot completo (solo admins)
export const updateParkingSpot = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            code, 
            parkingLotId, 
            floor, 
            zone, 
            spotType, 
            description, 
            isActive 
        } = req.body;
        
        const spot = await ParkingSpot.findByPk(id);
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        // Si cambia de parking lot, verificar que existe
        if (parkingLotId && parkingLotId !== spot.parkingLotId) {
            const parkingLot = await ParkingLot.findByPk(parkingLotId);
            if (!parkingLot) {
                return res.status(404).json({
                    success: false,
                    message: "Estacionamiento destino no encontrado"
                });
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

        // Actualizar contadores de parking lots afectados
        const affectedLots = [spot.parkingLotId];
        if (parkingLotId && parkingLotId !== spot.parkingLotId) {
            affectedLots.push(parkingLotId);
        }

        for (const lotId of affectedLots) {
            const totalSpots = await ParkingSpot.count({ 
                where: { parkingLotId: lotId, isActive: true } 
            });
            await ParkingLot.update({ totalSpots }, { where: { id: lotId } });
        }

        const updatedSpot = await ParkingSpot.findByPk(id, {
            include: [
                {
                    model: ParkingLot,
                    as: 'parkingLot',
                    attributes: ['id', 'name', 'location']
                }
            ]
        });

        res.json({
            success: true,
            message: "Espacio actualizado exitosamente",
            data: updatedSpot.getPublicData()
        });

    } catch (error) {
        console.error('Error en updateParkingSpot:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: "Ya existe un espacio con ese código en este estacionamiento"
            });
        }
        
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Eliminar parking spot (solo admins)
export const deleteParkingSpot = async (req, res) => {
    try {
        const { id } = req.params;
        
        const spot = await ParkingSpot.findByPk(id);
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        // Verificar si tiene sesiones activas
        const activeSessions = await ParkingSession.count({
            where: { 
                parkingSpotId: id, 
                endTime: null 
            }
        });

        if (activeSessions > 0) {
            return res.status(400).json({
                success: false,
                message: "No se puede eliminar el espacio porque tiene sesiones activas"
            });
        }

        const parkingLotId = spot.parkingLotId;
        
        await spot.destroy();

        // Actualizar contador del parking lot
        const totalSpots = await ParkingSpot.count({ 
            where: { parkingLotId, isActive: true } 
        });
        await ParkingLot.update({ totalSpots }, { where: { id: parkingLotId } });

        res.json({
            success: true,
            message: "Espacio eliminado exitosamente"
        });

    } catch (error) {
        console.error('Error en deleteParkingSpot:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Reservar un parking spot (usuarios)
export const reserveParkingSpot = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const spot = await ParkingSpot.findByPk(id);
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        if (spot.status !== 'available') {
            return res.status(400).json({
                success: false,
                message: "El espacio no está disponible para reserva"
            });
        }

        // Solo cambiar el estado a RESERVADO (sin tracking de usuario específico por simplicidad)
        await spot.update({ 
            status: 'RESERVADO'
        });

        const updatedSpot = await ParkingSpot.findByPk(id, {
            include: [
                {
                    model: ParkingLot,
                    as: 'parkingLot',
                    attributes: ['id', 'name', 'location']
                }
            ]
        });

        res.json({
            success: true,
            message: "Espacio reservado exitosamente",
            data: updatedSpot.getPublicData()
        });

    } catch (error) {
        console.error('Error en reserveParkingSpot:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Cancelar reserva (usuarios)
export const cancelReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const spot = await ParkingSpot.findByPk(id);
        
        if (!spot) {
            return res.status(404).json({
                success: false,
                message: "Espacio de estacionamiento no encontrado"
            });
        }

        if (spot.status !== 'RESERVADO') {
            return res.status(400).json({
                success: false,
                message: "Este espacio no está reservado"
            });
        }

        // Cualquier usuario puede cancelar reserva por simplicidad
        await spot.update({ 
            status: 'LIBRE'
        });

        const updatedSpot = await ParkingSpot.findByPk(id, {
            include: [
                {
                    model: ParkingLot,
                    as: 'parkingLot',
                    attributes: ['id', 'name', 'location']
                }
            ]
        });

        res.json({
            success: true,
            message: "Reserva cancelada exitosamente",
            data: updatedSpot.getPublicData()
        });

    } catch (error) {
        console.error('Error en cancelReservation:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

