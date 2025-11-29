import express from 'express';
import socketService from '../services/SocketService.js';
import iotSimulator from '../services/IoTSimulatorService.js';

const router = express.Router();

router.get('/test-socket', (req, res) => {
    try {
        const connectionInfo = socketService.getConnectionInfo();
        
        socketService.emit('test-event', {
            message: 'Test desde endpoint REST',
            timestamp: new Date().toISOString(),
            connectionInfo
        });

        res.json({
            success: true,
            message: 'Evento WebSocket enviado',
            connectionInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al enviar evento WebSocket',
            error: error.message
        });
    }
});

router.post('/simulate-spot-change/:spotId', (req, res) => {
    try {
        const { spotId } = req.params;
        const { status } = req.body;

        const spotData = {
            id: parseInt(spotId),
            status: status || 'occupied',
            timestamp: new Date().toISOString(),
            source: 'manual-simulation'
        };

        socketService.emitSpotStatusChange(spotData);

        res.json({
            success: true,
            message: 'Cambio de estado simulado',
            spotData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al simular cambio',
            error: error.message
        });
    }
});

router.post('/iot/start', (req, res) => {
    try {
        iotSimulator.startSimulation();
        res.json({
            success: true,
            message: 'Simulador IoT iniciado',
            stats: iotSimulator.getSimulationStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al iniciar simulador IoT',
            error: error.message
        });
    }
});

router.post('/iot/stop', (req, res) => {
    try {
        iotSimulator.stopSimulation();
        res.json({
            success: true,
            message: 'Simulador IoT detenido',
            stats: iotSimulator.getSimulationStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al detener simulador IoT',
            error: error.message
        });
    }
});

router.get('/iot/status', (req, res) => {
    try {
        res.json({
            success: true,
            stats: iotSimulator.getSimulationStats(),
            connectionInfo: socketService.getConnectionInfo()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado',
            error: error.message
        });
    }
});

router.post('/iot/failure/:spotId', (req, res) => {
    try {
        const { spotId } = req.params;
        iotSimulator.simulateSensorFailure(parseInt(spotId));
        
        res.json({
            success: true,
            message: `Falla de sensor simulada para spot ${spotId}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al simular falla',
            error: error.message
        });
    }
});

router.put('/iot/config', (req, res) => {
    try {
        const newConfig = req.body;
        iotSimulator.updateConfig(newConfig);
        
        res.json({
            success: true,
            message: 'Configuración actualizada',
            stats: iotSimulator.getSimulationStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar configuración',
            error: error.message
        });
    }
});

export default router;