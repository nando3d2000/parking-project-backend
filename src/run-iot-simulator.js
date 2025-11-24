import iotSimulator from './services/IoTSimulatorService.js';

console.log('🤖 Iniciando simulador IoT...');

// Iniciar el simulador
iotSimulator.startSimulation();

console.log('✅ Simulador IoT activo - generando cambios cada 60 segundos');
console.log('📡 Presiona Ctrl+C para detenerlo');

// Mostrar estadísticas cada 30 segundos
setInterval(() => {
  const stats = iotSimulator.getSimulationStats();
  console.log('🔄 Simulador activo - Cambios realizados:', stats.totalChanges);
}, 30000);

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo simulador IoT...');
  iotSimulator.stopSimulation();
  process.exit(0);
});