import { DataTypes } from "sequelize";
import sequelize from "../config/Db.js";
import bcrypt from "bcrypt";

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
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
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
            msg: "Este email ya está registrado"
        },
        validate: {
            isEmail: {
                msg: "Debe ser un email válido"
            },
            notEmpty: {
                msg: "El email no puede estar vacío"
            }
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: "La contraseña no puede estar vacía"
            },
            len: {
                args: [6, 100],
                msg: "La contraseña debe tener al menos 6 caracteres"
            }
        }
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        allowNull: false,
        defaultValue: 'user',
        validate: {
            isIn: {
                args: [['user', 'admin']],
                msg: "El rol debe ser 'user' o 'admin'"
            }
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            len: {
                args: [10, 15],
                msg: "El teléfono debe tener entre 10 y 15 dígitos"
            },
            isNumeric: {
                msg: "El teléfono debe contener solo números"
            }
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "users",
    timestamps: true,
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const saltRounds = 10;
                user.password = await bcrypt.hash(user.password, saltRounds);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const saltRounds = 10;
                user.password = await bcrypt.hash(user.password, saltRounds);
            }
        }
    }
});

User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

User.prototype.getPublicData = function() {
    return {
        id: this.id,
        name: this.name,
        email: this.email,
        role: this.role,
        phone: this.phone,
        isActive: this.isActive,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export default User;