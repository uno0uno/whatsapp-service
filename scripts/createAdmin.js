#!/usr/bin/env node

/**
 * Script para crear usuario administrador
 * Uso: node scripts/createAdmin.js
 */

require('dotenv').config();
const userService = require('../src/services/userService');
const db = require('../src/config/database');

async function createAdminUser() {
  try {
    console.log('🔧 Creando usuario administrador...\n');

    const adminData = {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@whatsapp-service.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      fullName: 'Administrador',
      role: 'admin'
    };

    // Verificar si ya existe
    const existingUser = await userService.findByUsername(adminData.username);

    if (existingUser) {
      console.log('⚠️  El usuario admin ya existe:');
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Created: ${existingUser.created_at}`);
      console.log('\n✅ No se requiere crear nuevo usuario admin\n');
      process.exit(0);
    }

    // Crear usuario admin
    const user = await userService.createUser(adminData);

    console.log('✅ Usuario administrador creado exitosamente!\n');
    console.log('Detalles del usuario:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('\n📝 Credenciales de acceso:');
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando usuario admin:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Cerrar pool de conexiones
    await db.pool.end();
  }
}

// Ejecutar
createAdminUser();
