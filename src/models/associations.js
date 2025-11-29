import User from './User.js';
import ParkingLot from './ParkingLot.js';
import ParkingSpot from './ParkingSpot.js';
import ParkingSession from './ParkingSession.js';

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

User.hasMany(ParkingSpot, {
    foreignKey: 'createdBy',
    as: 'createdParkingSpots',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
});

ParkingSpot.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
});

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