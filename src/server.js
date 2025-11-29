import app from "./app.js";
import sequelize from "./config/Db.js";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import socketService from "./services/SocketService.js";
import iotSimulator from "./services/IoTSimulatorService.js";
import { ParkingSpot } from "./models/associations.js";
import "./models/associations.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const IOT_SIMULATOR_START_DELAY = 2000;

const SOCKET_IO_CONFIG = {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  allowEIO3: true,
  transports: ["websocket", "polling"]
};

const PARKING_UPDATES_ROOM = 'parking-updates';

async function initializeDatabase() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
}

function setupWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.join(PARKING_UPDATES_ROOM);

    socket.on('disconnect', () => {});

    socket.on('request-parking-status', async () => {
      try {
        const spots = await ParkingSpot.findAll({
          attributes: ['id', 'code', 'status', 'parkingLotId', 'updatedAt']
        });
        
        spots.forEach(spot => {
          const spotData = {
            spotId: spot.id,
            code: spot.code,
            newStatus: spot.status,
            oldStatus: spot.status,
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
      } catch (error) {
        console.error('Error retrieving parking status:', error);
      }
    });
  });
}

async function startServer() {
  try {
    await initializeDatabase();

    const httpServer = createServer(app);
    const io = new Server(httpServer, SOCKET_IO_CONFIG);

    setupWebSocketHandlers(io);
    socketService.init(io);

    app.set('io', io);
    app.set('socketService', socketService);

    httpServer.listen(PORT, () => {
      setTimeout(() => {
        iotSimulator.startSimulation();
      }, IOT_SIMULATOR_START_DELAY);
    });
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
}

startServer(); 