const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Error inesperado en cliente de PostgreSQL', err);
});

// Función helper para hacer queries
const query = async (text, params) => {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error('Error en query:', error);
    throw error;
  }
};

// Función para obtener un cliente del pool (para transacciones)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Set timeout de 5 segundos
  const timeout = setTimeout(() => {
    console.error('Un cliente ha estado checado por más de 5 segundos!');
  }, 5000);

  // Monkey patch para hacer tracking del release
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
};

module.exports = {
  query,
  getClient,
  pool
};
