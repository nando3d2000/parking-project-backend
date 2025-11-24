/**
 * Servicio para manejar comunicación WebSocket de parking spots
 */
class SocketService {
    constructor() {
        this.io = null;
    }

    // Inicializar el servicio con la instancia de Socket.io
    init(io) {
        this.io = io;
        console.log('🔧 SocketService inicializado');
    }

    // Emitir cambio de estado de un parking spot
    emitSpotStatusChange(spotData) {
        if (!this.io) {
            console.warn('⚠️ Socket.io no inicializado');
            return;
        }

        const event = {
            type: 'SPOT_STATUS_CHANGE',
            timestamp: new Date().toISOString(),
            data: spotData
        };

        console.log('📡 Emitiendo cambio de spot:', event);
        
        // Emitir a todos los clientes conectados en el room 'parking-updates'
        this.io.to('parking-updates').emit('parking-spot-update', event);
    }

    // Emitir estadísticas actualizadas de un parking lot
    emitParkingLotStats(parkingLotId, stats) {
        if (!this.io) {
            console.warn('⚠️ Socket.io no inicializado');
            return;
        }

        const event = {
            type: 'PARKING_LOT_STATS',
            timestamp: new Date().toISOString(),
            parkingLotId,
            stats
        };

        console.log('📊 Emitiendo estadísticas de parking lot:', event);
        
        this.io.to('parking-updates').emit('parking-lot-stats-update', event);
    }

    // Emitir evento de sensor IoT simulado
    emitIoTSensorData(sensorData) {
        if (!this.io) {
            console.warn('⚠️ Socket.io no inicializado');
            return;
        }

        const event = {
            type: 'IOT_SENSOR_DATA',
            timestamp: new Date().toISOString(),
            data: sensorData
        };

        console.log('🤖 Emitiendo datos de sensor IoT:', event);
        
        this.io.to('parking-updates').emit('iot-sensor-update', event);
    }

    // Obtener información de conexiones activas
    getConnectionInfo() {
        if (!this.io) {
            return { connectedClients: 0, rooms: [] };
        }

        const sockets = this.io.sockets.sockets;
        const connectedClients = sockets.size;
        
        return {
            connectedClients,
            serverTime: new Date().toISOString()
        };
    }

    // Emitir evento personalizado
    emit(event, data) {
        if (!this.io) {
            console.warn('⚠️ Socket.io no inicializado');
            return;
        }

        this.io.to('parking-updates').emit(event, {
            timestamp: new Date().toISOString(),
            data
        });
    }
}

// Crear instancia singleton
const socketService = new SocketService();

export default socketService;