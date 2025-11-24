import { ParkingSpot } from '../models/associations.js';
import socketService from './SocketService.js';

/**
 * Simulador de dispositivos IoT para parking spots
 * Simula sensores que detectan ocupación/liberación de espacios
 */
class IoTSimulatorService {
    constructor() {
        this.isRunning = false;
        this.intervals = [];
        this.simulationConfig = {
            // Intervalo entre cambios (cada 15 segundos para demo)
            changeInterval: 15000, // 15 segundos
            // Probabilidad de que un spot cambie en cada ciclo
            changeProbability: 0.3, // 30% probabilidad (aumentada para más actividad)
            // Solo permitir transiciones realistas
            allowedTransitions: {
                'LIBRE': 'OCUPADO',     // Vehículo llega
                'OCUPADO': 'LIBRE'      // Vehículo se va
            },
            // Estados que NO deben ser modificados por IoT
            protectedStates: ['RESERVADO', 'MANTENIMIENTO']
        };
    }

    // Iniciar simulación automática
    startSimulation() {
        if (this.isRunning) {
            console.log('🤖 Simulador IoT ya está ejecutándose');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Iniciando simulador IoT realista...');
        console.log(`📊 Configuración: Intervalo ${this.simulationConfig.changeInterval/1000}s, Probabilidad ${this.simulationConfig.changeProbability * 100}%`);
        console.log('🚗 Solo transiciones: LIBRE ↔ OCUPADO');

        // Intervalo único para simulación realista
        const mainInterval = setInterval(async () => {
            await this.simulateRealisticChanges();
        }, this.simulationConfig.changeInterval);

        this.intervals.push(mainInterval);
    }

    // Detener simulación
    stopSimulation() {
        if (!this.isRunning) {
            console.log('🤖 Simulador IoT no está ejecutándose');
            return;
        }

        this.isRunning = false;
        
        // Limpiar todos los intervalos
        this.intervals.forEach(interval => {
            clearInterval(interval);
        });
        this.intervals = [];

        console.log('⏹️ Simulador IoT detenido');
    }

    // Simulación realista cada minuto
    async simulateRealisticChanges() {
        try {
            console.log('🔄 Ejecutando ciclo de simulación IoT...');
            
            // Obtener solo spots que pueden cambiar (LIBRE o OCUPADO)
            const availableSpots = await ParkingSpot.findAll({
                where: { 
                    isActive: true,
                    status: ['LIBRE', 'OCUPADO'] // Solo estos estados
                }
            });

            if (availableSpots.length === 0) {
                console.log('⚠️ No hay spots disponibles para simulación (solo LIBRE/OCUPADO)');
                return;
            }

            console.log(`📊 Spots elegibles para cambio: ${availableSpots.length}`);

            // Seleccionar un spot aleatorio del conjunto elegible
            const randomSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
            
            // Determinar el nuevo estado basado en el estado actual
            const currentStatus = randomSpot.status;
            const newStatus = this.simulationConfig.allowedTransitions[currentStatus];

            if (newStatus) {
                const action = newStatus === 'OCUPADO' ? 'llegada' : 'salida';
                await this.changeSpotStatus(
                    randomSpot, 
                    newStatus, 
                    `vehicle_${action}`,
                    `Sensor detectó ${action} de vehículo`
                );
            }

        } catch (error) {
            console.error('❌ Error en simulación realista:', error);
        }
    }

    // Generar ID único de sensor para cada spot
    generateSensorId(spotId) {
        return `IOT_SENSOR_${String(spotId).padStart(3, '0')}`;
    }

    // Simular datos de sensor IoT realistas
    generateSensorData(spotId, status) {
        const sensorId = this.generateSensorId(spotId);
        
        return {
            sensorId,
            spotId,
            status,
            // Datos del sensor
            signalStrength: Math.floor(Math.random() * 30) + 70,    // 70-100%
            batteryLevel: Math.floor(Math.random() * 20) + 80,     // 80-100%
            temperature: Math.floor(Math.random() * 10) + 20,      // 20-30°C
            humidity: Math.floor(Math.random() * 20) + 40,         // 40-60%
            // Metadatos del dispositivo
            deviceType: 'ultrasonic_distance_sensor',
            firmware: 'v2.1.3',
            lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Últimos 30 días
            // Estado de la detección
            confidence: status === 'OCUPADO' ? 
                Math.floor(Math.random() * 15) + 85 :  // 85-100% cuando ocupado
                Math.floor(Math.random() * 20) + 75,   // 75-95% cuando libre
            detectionMethod: status === 'OCUPADO' ? 'object_detected' : 'clear_path'
        };
    }

    // Cambiar estado de spot y emitir evento (versión mejorada)
    async changeSpotStatus(spot, newStatus, source = 'iot_sensor', description = '') {
        try {
            const oldStatus = spot.status;
            
            // Verificar que el cambio sea válido
            if (this.simulationConfig.protectedStates.includes(oldStatus)) {
                console.log(`🚫 Spot ${spot.code} en estado protegido ${oldStatus}, no se modifica`);
                return;
            }

            // Actualizar en base de datos
            await spot.update({ status: newStatus });

            // Generar datos completos del sensor IoT
            const sensorData = this.generateSensorData(spot.id, newStatus);
            
            // Preparar datos del evento de cambio de spot
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

            // Emitir evento de cambio de spot
            socketService.emitSpotStatusChange(spotChangeEvent);

            // Emitir datos completos del sensor IoT
            socketService.emitIoTSensorData(sensorData);

            const action = newStatus === 'OCUPADO' ? '🚗 LLEGADA' : '🚙 SALIDA';
            console.log(`${action} | Spot ${spot.code} | ${oldStatus} → ${newStatus} | Sensor: ${sensorData.sensorId}`);

        } catch (error) {
            console.error('❌ Error cambiando estado de spot:', error);
        }
    }

    // Simular falla de sensor (solo para testing)
    async simulateSensorFailure(spotId) {
        try {
            const spot = await ParkingSpot.findByPk(spotId);
            if (!spot) {
                console.log(`❌ Spot ${spotId} no encontrado`);
                return;
            }

            // Solo permitir fallas en spots LIBRE u OCUPADO
            if (this.simulationConfig.protectedStates.includes(spot.status)) {
                console.log(`🚫 No se puede simular falla en spot ${spot.code} - Estado protegido: ${spot.status}`);
                return;
            }

            const sensorId = this.generateSensorId(spotId);
            console.log(`⚠️ Simulando falla del sensor ${sensorId} para spot ${spot.code}`);
            
            await this.changeSpotStatus(spot, 'MANTENIMIENTO', 'sensor_failure', 
                `Sensor ${sensorId} reportó falla - Requiere mantenimiento`);
            
            // Auto-reparación después de 2 minutos (para testing)
            setTimeout(async () => {
                const updatedSpot = await ParkingSpot.findByPk(spotId);
                if (updatedSpot && updatedSpot.status === 'MANTENIMIENTO') {
                    await this.changeSpotStatus(updatedSpot, 'LIBRE', 'sensor_repaired',
                        `Sensor ${sensorId} reparado - Volviendo a operación normal`);
                }
            }, 120000); // 2 minutos
            
        } catch (error) {
            console.error('❌ Error simulando falla de sensor:', error);
        }
    }

    // Obtener estadísticas del simulador
    getSimulationStats() {
        return {
            isRunning: this.isRunning,
            activeIntervals: this.intervals.length,
            config: this.simulationConfig,
            uptime: this.isRunning ? 'Running' : 'Stopped'
        };
    }

    // Actualizar configuración del simulador
    updateConfig(newConfig) {
        this.simulationConfig = {
            ...this.simulationConfig,
            ...newConfig
        };
        
        console.log('⚙️ Configuración del simulador actualizada:', this.simulationConfig);
        
        // Si está ejecutándose, reiniciar con nueva configuración
        if (this.isRunning) {
            this.stopSimulation();
            setTimeout(() => {
                this.startSimulation();
            }, 1000);
        }
    }
}

// Crear instancia singleton
const iotSimulator = new IoTSimulatorService();

export default iotSimulator;