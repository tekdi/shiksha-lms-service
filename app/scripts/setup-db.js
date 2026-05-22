const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const dotenv = require('dotenv');

const appRoot = path.resolve(__dirname, '..');
const envPath = path.join(appRoot, '.env');
const envExamplePath = path.join(appRoot, 'env.example');

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    return;
  }

  fs.copyFileSync(envExamplePath, envPath);
  log('Created app/.env from app/env.example.');
  fail(
    'Update app/.env with your database credentials, then rerun `npm run db:setup`.',
  );
}

function loadConfig() {
  ensureEnvFile();

  const result = dotenv.config({ path: envPath });
  if (result.error) {
    fail(`Unable to load ${envPath}: ${result.error.message}`);
  }

  const requiredKeys = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE',
  ];

  const missingKeys = requiredKeys.filter((key) => !process.env[key]);
  if (missingKeys.length > 0) {
    fail(`Missing required variables in app/.env: ${missingKeys.join(', ')}`);
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  };
}

async function databaseExists(adminConfig, database) {
  const client = new Client(adminConfig);
  await client.connect();

  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    return result.rowCount > 0;
  } finally {
    await client.end();
  }
}

async function createDatabase(adminConfig, database) {
  const client = new Client(adminConfig);
  await client.connect();

  try {
    await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

async function ensureUuidExtension(config) {
  const client = new Client(config);
  await client.connect();

  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } finally {
    await client.end();
  }
}

function runMigrations() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'migration:run'], {
    cwd: appRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const config = loadConfig();

  if (Number.isNaN(config.port)) {
    fail('DB_PORT must be a valid number in app/.env.');
  }

  log('Setting up the Shiksha LMS database...');
  log(`Postgres host: ${config.host}:${config.port}`);
  log(`Target database: ${config.database}`);
  log(`Database user: ${config.user}`);

  const adminConfig = { ...config, database: 'postgres' };

  try {
    const exists = await databaseExists(adminConfig, config.database);
    if (!exists) {
      log(`Creating database "${config.database}"...`);
      await createDatabase(adminConfig, config.database);
    } else {
      log(`Database "${config.database}" already exists.`);
    }

    await ensureUuidExtension(config);
  } catch (error) {
    fail(`Database setup failed: ${error.message}`);
  }

  log('Running TypeORM migrations...');
  runMigrations();
  log('Database setup completed. Start the app with `npm run start:dev`.');
}

main();
