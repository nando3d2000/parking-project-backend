const { Sequelize } = require('sequelize');
const { ParkingLot } = require('./models/ParkingLot');
const { ParkingSpot } = require('./models/ParkingSpot');

// Configurar conexión a la base de datos
const sequelize = new Sequelize('parking_system', 'parking_user', 'parking_password', {
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function createSampleParkingLots() {
  try {
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');

    // Verificar parking lots existentes
    const existingLots = await ParkingLot.findAll();
    console.log(`📊 Parking lots existentes: ${existingLots.length}`);

    if (existingLots.length === 0) {
      console.log('🏗️ Creando parking lots de ejemplo...');
      
      const sampleLots = [
        {
          name: 'Parqueadero Principal IUSH',
          location: 'Edificio Principal - Bloque A',
          description: 'Parqueadero principal para estudiantes y profesores del edificio A',
          totalSpots: 120,
          isActive: true
        },
        {
          name: 'Parqueadero Biblioteca',
          location: 'Biblioteca Central',
          description: 'Espacios de estacionamiento exclusivos para usuarios de la biblioteca',
          totalSpots: 80,
          isActive: true
        },
        {
          name: 'Parqueadero Administrativo',
          location: 'Edificio Administrativo',
          description: 'Estacionamiento reservado para personal administrativo y visitantes',
          totalSpots: 60,
          isActive: true
        },
        {
          name: 'Parqueadero Laboratorios',
          location: 'Edificio de Laboratorios - Bloque B',
          description: 'Parqueadero para estudiantes que utilizan los laboratorios',
          totalSpots: 45,
          isActive: true
        },
        {
          name: 'Parqueadero Cafetería',
          location: 'Centro de Bienestar Universitario',
          description: 'Espacios de corta estadía para usuarios de la cafetería',
          totalSpots: 35,
          isActive: true
        }
      ];

      for (const lotData of sampleLots) {
        const lot = await ParkingLot.create(lotData);
        console.log(`✅ Creado: ${lot.name} (${lot.totalSpots} espacios)`);
      }

      console.log('🎉 Parking lots de ejemplo creados exitosamente');
    } else {
      console.log('ℹ️ Ya existen parking lots en la base de datos');
      existingLots.forEach(lot => {
        console.log(`- ${lot.name} (${lot.totalSpots} espacios)`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Ejecutar el script
createSampleParkingLots();