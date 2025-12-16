#!/usr/bin/env node

/**
 * Script to create admin user
 * Usage: node scripts/createAdmin.js
 */

require('dotenv').config();
const userService = require('../src/services/userService');
const db = require('../src/config/database');

async function createAdminUser() {
  try {
    console.log('Creating admin user...\n');

    const adminData = {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@whatsapp-service.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      fullName: 'Administrator',
      role: 'admin'
    };

    // Check if it already exists
    const existingUser = await userService.findByUsername(adminData.username);

    if (existingUser) {
      console.log('Admin user already exists:');
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Created: ${existingUser.created_at}`);
      console.log('\nNo need to create new admin user\n');
      process.exit(0);
    }

    // Create admin user
    const user = await userService.createUser(adminData);

    console.log('Admin user created successfully!\n');
    console.log('User details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('\nAccess credentials:');
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('\nIMPORTANT: Change the password after first login\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close connection pool
    await db.pool.end();
  }
}

// Execute
createAdminUser();
