export const calculateSpotStatistics = (spots) => {
    const stats = {
        total: spots.length,
        available: 0,
        occupied: 0,
        reserved: 0,
        maintenance: 0
    };

    spots.forEach(spot => {
        const status = spot.status || spot.dataValues?.status;
        switch(status) {
            case 'LIBRE':
                stats.available++;
                break;
            case 'OCUPADO':
                stats.occupied++;
                break;
            case 'RESERVADO':
                stats.reserved++;
                break;
            case 'MANTENIMIENTO':
                stats.maintenance++;
                break;
        }
    });

    return stats;
};

export const calculatePaginationData = (totalCount, currentPage, itemsPerPage) => {
    return {
        currentPage: parseInt(currentPage),
        totalPages: Math.ceil(totalCount / itemsPerPage),
        totalItems: totalCount,
        itemsPerPage: parseInt(itemsPerPage)
    };
};

export const mapDatabaseStatusToApi = (dbStatus) => {
    const statusMap = {
        'LIBRE': 'available',
        'OCUPADO': 'occupied',
        'RESERVADO': 'reserved',
        'MANTENIMIENTO': 'maintenance'
    };
    
    return statusMap[dbStatus] || 'available';
};

export const mapApiStatusToDatabase = (apiStatus) => {
    const statusMap = {
        'available': 'LIBRE',
        'occupied': 'OCUPADO',
        'reserved': 'RESERVADO',
        'maintenance': 'MANTENIMIENTO'
    };
    
    return statusMap[apiStatus] || 'LIBRE';
};

export const buildPaginationFilters = (queryParams) => {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 10;
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};
