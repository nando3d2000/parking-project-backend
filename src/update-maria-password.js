import { Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

// Configurar conexión a la base de datos
const sequelize = new Sequelize('apidb', 'root', 'chepe123', {
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function updateMariaPassword() {
  try {
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');

    // Nueva contraseña para María
    const newPassword = 'maria123';
    
    // Hashear la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('🔐 Nueva contraseña hasheada:', hashedPassword);

    // Actualizar la contraseña de María Rodriguez
    const [affectedRows] = await sequelize.query(`
      UPDATE users 
      SET password = :hashedPassword 
      WHERE email = 'maria.rodriguez@email.com'
    `, {
      replacements: { hashedPassword },
      type: sequelize.QueryTypes.UPDATE
    });

    if (affectedRows > 0) {
      console.log('✅ Contraseña actualizada exitosamente para maria.rodriguez@email.com');
      console.log('📝 Nueva contraseña:', newPassword);
      console.log('💡 Ahora puedes hacer login con:');
      console.log('   Email: maria.rodriguez@email.com');
      console.log('   Contraseña:', newPassword);
    } else {
      console.log('⚠️ No se encontró el usuario maria.rodriguez@email.com');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Ejecutar el script
updateMariaPassword();