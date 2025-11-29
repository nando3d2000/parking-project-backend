import { ParkingSpot } from '../models/associations.js';
import socketService from './SocketService.js';

const SIMULATION_CONFIG = {
  changeInterval: 15000,
  changeProbability: 0.3,
  allowedTransitions: {
    'LIBRE': 'OCUPADO',
    'OCUPADO': 'LIBRE'
  },
  protectedStates: ['RESERVADO', 'MANTENIMIENTO']
};

class IoTSimulatorService {
  constructor() {
    this.isRunning = false;
    this.intervals = [];
  }

  startSimulation() {
    if (this.isRunning) return;

    this.isRunning = true;
    const mainInterval = setInterval(() => this.simulateRealisticChanges(), SIMULATION_CONFIG.changeInterval);
    this.intervals.push(mainInterval);
  }

  stopSimulation() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  async simulateRealisticChanges() {
    try {
      const availableSpots = await ParkingSpot.findAll({
        where: { 
          isActive: true,
          status: ['LIBRE', 'OCUPADO']
        }
      });

      if (availableSpots.length === 0) return;

      const randomSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
      const currentStatus = randomSpot.status;
      const newStatus = SIMULATION_CONFIG.allowedTransitions[currentStatus];

      if (newStatus) {
        const action = newStatus === 'OCUPADO' ? 'llegada' : 'salida';
        await this.changeSpotStatus(randomSpot, newStatus, `vehicle_${action}`, `Sensor detectó ${action} de vehículo`);
      }
    } catch (error) {
      console.error('Error in IoT simulation:', error);
    }
  }

  generateSensorId(spotId) {
    return `IOT_SENSOR_${String(spotId).padStart(3, '0')}`;
  }

  generateSensorData(spotId, status) {
    return {
      sensorId: this.generateSensorId(spotId),
      spotId,
      status,
      signalStrength: Math.floor(Math.random() * 30) + 70,
      batteryLevel: Math.floor(Math.random() * 20) + 80,
      temperature: Math.floor(Math.random() * 10) + 20,
      humidity: Math.floor(Math.random() * 20) + 40,
      deviceType: 'ultrasonic_distance_sensor',
      firmware: 'v2.1.3',
      lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: status === 'OCUPADO' ? 
        Math.floor(Math.random() * 15) + 85 :
        Math.floor(Math.random() * 20) + 75,
      detectionMethod: status === 'OCUPADO' ? 'object_detected' : 'clear_path'
    };
  }

  async changeSpotStatus(spot, newStatus, source = 'iot_sensor', description = '') {
    try {
      const oldStatus = spot.status;
      
      if (SIMULATION_CONFIG.protectedStates.includes(oldStatus)) return;

      await spot.update({ status: newStatus });

      const sensorData = this.generateSensorData(spot.id, newStatus);
      
      const spotChangeEvent = {
        spotId: spot.id,
        code: spot.code,
        oldStatus,
        newStatus,
        parkingLotId: spot.parkingLotId,
        timestamp: new Date().toISOString(),
        source,
        description: description || `Sensor ${sensorData.sensorId} detectó cambio`,
        sensorData: {
          sensorId: sensorData.sensorId,
          confidence: sensorData.confidence,
          detectionMethod: sensorData.detectionMethod
        }
      };

      socketService.emitSpotStatusChange(spotChangeEvent);
      socketService.emitIoTSensorData(sensorData);
    } catch (error) {
      console.error('Error changing spot status:', error);
    }
  }

  async simulateSensorFailure(spotId) {
    try {
      const spot = await ParkingSpot.findByPk(spotId);
      if (!spot || SIMULATION_CONFIG.protectedStates.includes(spot.status)) return;

      const sensorId = this.generateSensorId(spotId);
      await this.changeSpotStatus(spot, 'MANTENIMIENTO', 'sensor_failure', 
        `Sensor ${sensorId} reportó falla - Requiere mantenimiento`);
      
      setTimeout(async () => {
        const updatedSpot = await ParkingSpot.findByPk(spotId);
        if (updatedSpot && updatedSpot.status === 'MANTENIMIENTO') {
          await this.changeSpotStatus(updatedSpot, 'LIBRE', 'sensor_repaired',
            `Sensor ${sensorId} reparado - Volviendo a operación normal`);
        }
      }, 120000);
    } catch (error) {
      console.error('Error simulating sensor failure:', error);
    }
  }

  getSimulationStats() {
    return {
      isRunning: this.isRunning,
      activeIntervals: this.intervals.length,
      config: SIMULATION_CONFIG,
      uptime: this.isRunning ? 'Running' : 'Stopped'
    };
  }

  updateConfig(newConfig) {
    Object.assign(SIMULATION_CONFIG, newConfig);
    
    if (this.isRunning) {
      this.stopSimulation();
      setTimeout(() => this.startSimulation(), 1000);
    }
  }
}

const iotSimulator = new IoTSimulatorService();

export default iotSimulator;