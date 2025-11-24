import User from './User.js';
import ParkingLot from './ParkingLot.js';
import ParkingSpot from './ParkingSpot.js';
import ParkingSession from './ParkingSession.js';

// Configurar todas las relaciones entre modelos

// ParkingLot tiene muchos ParkingSpots
ParkingLot.hasMany(ParkingSpot, {
    foreignKey: 'parkingLotId',
    as: 'parkingSpots',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});

ParkingSpot.belongsTo(ParkingLot, {
    foreignKey: 'parkingLotId',
    as: 'parkingLot'
});

// User puede crear muchos ParkingSpots (como admin)
User.hasMany(ParkingSpot, {
    foreignKey: 'createdBy',
    as: 'createdParkingSpots',
    onDelete: 'RESTRICT', // No permitir eliminar usuario que ha creado spots
    onUpdate: 'CASCADE'
});

ParkingSpot.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
});

// ParkingSpot puede tener muchas ParkingSessions
ParkingSpot.hasMany(ParkingSession, {
    foreignKey: 'parkingSpotId',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});

ParkingSession.belongsTo(ParkingSpot, {
    foreignKey: 'parkingSpotId',
    as: 'parkingSpot'
});

// User puede tener muchas ParkingSessions
User.hasMany(ParkingSession, {
    foreignKey: 'userId',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});

ParkingSession.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

export {
    User,
    ParkingLot,
    ParkingSpot,
    ParkingSession
};