const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../database');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

async function ensureAdmin() {
  const email = 'admin@mundial2026.com';
  const password = 'Admin2026!';
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Administrador', $1, $2, 'admin')
    ON CONFLICT (email) DO UPDATE
    SET role = 'admin', updated_at = CURRENT_TIMESTAMP
  `, [email, passwordHash]);

  console.log('Usuario admin listo:', email, '/', password);
}

async function main() {
  try {
    console.log('Inicializando base de datos...');
    await runSqlFile(path.join(__dirname, 'schema.sql'));
    await runSqlFile(path.join(__dirname, 'seed.sql'));
    await ensureAdmin();
    console.log('Base de datos inicializada correctamente.');
  } catch (error) {
    console.error('Error al inicializar la base:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
