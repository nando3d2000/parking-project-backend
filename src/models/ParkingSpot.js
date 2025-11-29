import { DataTypes } from "sequelize";
import sequelize from "../config/Db.js";

const ParkingSpot = sequelize.define("ParkingSpot", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: false,
        validate: {
            notEmpty: {
                msg: "El código no puede estar vacío"
            }
        }
    },
    spotType: {
        type: DataTypes.ENUM('car', 'motorcycle'),
        allowNull: false,
        validate: {
            isIn: {
                args: [['car', 'motorcycle']],
                msg: "El tipo de espacio debe ser 'car' o 'motorcycle'"
            }
        }
    },
    status: {
        type: DataTypes.ENUM('LIBRE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO'),
        allowNull: false,
        defaultValue: 'LIBRE',
        validate: {
            isIn: {
                args: [['LIBRE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO']],
                msg: "El estado debe ser LIBRE, OCUPADO, RESERVADO o MANTENIMIENTO"
            }
        }
    },
    parkingLotId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'parking_lots',
            key: 'id'
        }
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "parking_spots",
    timestamps: true,
    hooks: {
        beforeCreate: async (spot, options) => {
            const prefix = spot.spotType === 'car' ? 'CAR' : 'MOTO';
            const timestamp = Date.now();
            spot.code = `${prefix}-${timestamp}`;
        },
        afterCreate: async (spot, options) => {
            const prefix = spot.spotType === 'car' ? 'CAR' : 'MOTO';
            const finalCode = `${prefix}-${spot.id}`;
            await spot.update({ code: finalCode }, { transaction: options.transaction });
        }
    }
});

ParkingSpot.prototype.getPublicData = function() {
    return {
        id: this.id,
        code: this.code,
        spotType: this.spotType,
        status: this.status,
        parkingLotId: this.parkingLotId,
        isActive: this.isActive,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export default ParkingSpot;