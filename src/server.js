require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { buildApp } = require('./app');

const required = ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} must be set.`);
}

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  waitForConnections: true, connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10), timezone: 'Z'
});
const app = buildApp({ pool });

async function start() {
  if (process.env.MYSQL_INIT_SCHEMA === 'true') {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    await pool.query(schema);
  }
  await app.listen({ host: process.env.HOST || '0.0.0.0', port: Number(process.env.PORT || 3000) });
}

async function stop() { await app.close(); await pool.end(); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
start().catch(async (error) => { app.log.error(error); await stop(); process.exitCode = 1; });
