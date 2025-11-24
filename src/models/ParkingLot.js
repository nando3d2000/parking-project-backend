import { DataTypes } from "sequelize";
import sequelize from "../config/Db.js";

const ParkingLot = sequelize.define("ParkingLot", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
            msg: "Ya existe un estacionamiento con este nombre"
        },
        validate: {
            notEmpty: {
                msg: "El nombre no puede estar vacío"
            },
            len: {
                args: [2, 100],
                msg: "El nombre debe tener entre 2 y 100 caracteres"
            }
        }
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: "La ubicación no puede estar vacía"
            },
            len: {
                args: [5, 255],
                msg: "La ubicación debe tener entre 5 y 255 caracteres"
            }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: {
                args: [0, 500],
                msg: "La descripción no puede tener más de 500 caracteres"
            }
        }
    },
    totalSpots: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: {
                args: [0],
                msg: "El total de espacios no puede ser negativo"
            },
            isInt: {
                msg: "El total de espacios debe ser un número entero"
            }
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "parking_lots",
    timestamps: true
});

// Método para obtener datos públicos del estacionamiento
ParkingLot.prototype.getPublicData = function() {
    return {
        id: this.id,
        name: this.name,
        location: this.location,
        description: this.description,
        totalSpots: this.totalSpots,
        isActive: this.isActive,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export default ParkingLot;