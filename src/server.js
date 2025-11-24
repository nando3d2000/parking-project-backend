import app from "./app.js";
import sequelize from "./config/Db.js";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import socketService from "./services/SocketService.js";
import iotSimulator from "./services/IoTSimulatorService.js";
import { ParkingSpot } from "./models/associations.js";
// Importar las relaciones de los modelos
import "./models/associations.js";

dotenv.config()
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la BD");

    // Sincronizar modelos con alter: true para actualizar tablas existentes
    await sequelize.sync({ alter: true });
    console.log("Modelos Sincronizados");

    // Crear servidor HTTP
    const httpServer = createServer(app);

    // Configurar Socket.io con CORS para el frontend
    const io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"], // URLs del frontend
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["*"]
      },
      allowEIO3: true,
      transports: ["websocket", "polling"]
    });

    // Configurar eventos de Socket.io
    io.on('connection', (socket) => {
      console.log('🔗 Cliente conectado:', socket.id);

      // Unir cliente a room de parking updates
      socket.join('parking-updates');
      console.log('📡 Cliente unido a parking-updates');

      // Manejar desconexión
      socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
      });

      // Manejar solicitud de estado actual de parqueaderos
      socket.on('request-parking-status', async () => {
        console.log('📊 Cliente solicitó estado actual de parqueaderos');
        
        try {
          // Obtener todos los spots existentes
          const spots = await ParkingSpot.findAll({
            attributes: ['id', 'code', 'status', 'parkingLotId', 'updatedAt']
          });
          
          console.log(`📤 Enviando ${spots.length} spots como estado inicial`);
          
          // Enviar cada spot como un evento de actualización
          spots.forEach(spot => {
            const spotData = {
              spotId: spot.id,
              code: spot.code,
              newStatus: spot.status,
              oldStatus: spot.status, // Para el estado inicial, son iguales
              parkingLotId: spot.parkingLotId,
              sensorData: {
                sensorId: `IOT_SENSOR_${spot.id.toString().padStart(3, '0')}`,
                confidence: 95,
                detectionMethod: 'initial_load'
              }
            };
            
            const event = {
              type: 'INITIAL_SPOT_STATUS',
              timestamp: new Date().toISOString(),
              data: spotData
            };
            
            socket.emit('parking-spot-update', event);
          });
          
          console.log('✅ Estado inicial enviado al cliente');
          
        } catch (error) {
          console.error('❌ Error obteniendo estado inicial:', error);
        }
      });
    });

    // Inicializar SocketService
    socketService.init(io);

    // Hacer el objeto io disponible globalmente para otros módulos
    app.set('io', io);
    app.set('socketService', socketService);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor HTTP ejecutando en http://localhost:${PORT}`);
      console.log(`⚡ WebSocket Server activo en puerto ${PORT}`);
      
      // Iniciar simulador IoT después de que Socket.io esté listo
      setTimeout(() => {
        console.log('🤖 Iniciando simulador IoT integrado...');
        iotSimulator.startSimulation();
        console.log('✅ Simulador IoT integrado iniciado (cada 15 segundos para demo)');
      }, 2000); // Esperar 2 segundos para asegurar que todo esté listo
    });
  } catch (error) {
    console.error("Error al conectar a la BD", error);
  }
}

startServer(); 