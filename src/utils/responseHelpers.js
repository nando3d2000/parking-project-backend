export const successResponse = (res, data, message = "Operación exitosa", statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

export const errorResponse = (res, message = "Error interno del servidor", statusCode = 500, error = null) => {
    const response = {
        success: false,
        message
    };
    
    if (error && process.env.NODE_ENV === 'development') {
        response.error = error.message;
    }
    
    return res.status(statusCode).json(response);
};

export const handleSequelizeError = (res, error) => {
    if (error.name === 'SequelizeUniqueConstraintError') {
        return errorResponse(res, "Ya existe un registro con estos datos", 400, error);
    }
    
    if (error.name === 'SequelizeValidationError') {
        return errorResponse(res, error.errors[0].message, 400, error);
    }
    
    return errorResponse(res, "Error interno del servidor", 500, error);
};
