class SocketService {
  constructor() {
    this.io = null;
  }

  init(io) {
    this.io = io;
  }

  emitSpotStatusChange(spotData) {
    if (!this.io) return;

    const event = {
      type: 'SPOT_STATUS_CHANGE',
      timestamp: new Date().toISOString(),
      data: spotData
    };
    
    this.io.to('parking-updates').emit('parking-spot-update', event);
  }

  emitParkingLotStats(parkingLotId, stats) {
    if (!this.io) return;

    const event = {
      type: 'PARKING_LOT_STATS',
      timestamp: new Date().toISOString(),
      parkingLotId,
      stats
    };
    
    this.io.to('parking-updates').emit('parking-lot-stats-update', event);
  }

  emitIoTSensorData(sensorData) {
    if (!this.io) return;

    const event = {
      type: 'IOT_SENSOR_DATA',
      timestamp: new Date().toISOString(),
      data: sensorData
    };
    
    this.io.to('parking-updates').emit('iot-sensor-update', event);
  }

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

  emit(event, data) {
    if (!this.io) return;

    this.io.to('parking-updates').emit(event, {
      timestamp: new Date().toISOString(),
      data
    });
  }
}

const socketService = new SocketService();

export default socketService;