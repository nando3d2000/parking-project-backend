import { DataTypes } from "sequelize";
import sequelize from "../config/Db.js";

const ParkingSession = sequelize.define("ParkingSession", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    parkingSpotId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'parking_spots',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    sessionType: {
        type: DataTypes.ENUM('walk_in', 'reserved'),
        allowNull: false,
        defaultValue: 'walk_in',
        validate: {
            isIn: {
                args: [['walk_in', 'reserved']],
                msg: "El tipo de sesión debe ser 'walk_in' o 'reserved'"
            }
        }
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: {
                args: 0,
                msg: "El monto total no puede ser negativo"
            }
        }
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: {
                args: [0, 500],
                msg: "Las notas no pueden tener más de 500 caracteres"
            }
        }
    }
}, {
    tableName: "parking_sessions",
    timestamps: true,
    indexes: [
        {
            fields: ['userId'],
            name: 'idx_session_user'
        },
        {
            fields: ['parkingSpotId'],
            name: 'idx_session_spot'
        },
        {
            fields: ['isActive'],
            name: 'idx_session_active'
        },
        {
            fields: ['startTime'],
            name: 'idx_session_start_time'
        }
    ]
});

ParkingSession.prototype.getDuration = function() {
    const start = new Date(this.startTime);
    const end = this.endTime ? new Date(this.endTime) : new Date();
    
    const diffMs = end - start;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    return {
        totalMinutes: diffMinutes,
        hours: hours,
        minutes: minutes,
        formatted: `${hours}h ${minutes}m`
    };
};

ParkingSession.prototype.endSession = async function(amount = null) {
    this.endTime = new Date();
    this.isActive = false;
    if (amount !== null) {
        this.totalAmount = amount;
    }
    await this.save();
    return this;
};

ParkingSession.prototype.getPublicData = function() {
    return {
        id: this.id,
        parkingSpotId: this.parkingSpotId,
        userId: this.userId,
        startTime: this.startTime,
        endTime: this.endTime,
        isActive: this.isActive,
        sessionType: this.sessionType,
        totalAmount: this.totalAmount,
        notes: this.notes,
        duration: this.getDuration(),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export default ParkingSession;