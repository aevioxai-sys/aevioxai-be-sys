const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const dbType = process.env.DB_TYPE || 'postgres';
const connectionString = process.env.DATABASE_URL;

let postgresPool;
let mongoClient;
let mongoDb;

async function initDb() {
  if (!connectionString) throw new Error('DATABASE_URL must be set');

  if (dbType === 'mongo') {
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    mongoDb = mongoClient.db();

    await mongoDb.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoDb.collection('refresh_tokens').createIndex({ token: 1 }, { unique: true });
    return;
  }

  postgresPool = new Pool({ connectionString });
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function getUserCollection() {
  if (dbType !== 'mongo') throw new Error('Mongo driver not active');
  return mongoDb.collection('users');
}

function getRefreshCollection() {
  if (dbType !== 'mongo') throw new Error('Mongo driver not active');
  return mongoDb.collection('refresh_tokens');
}

function generateId() {
  return crypto.randomUUID();
}

async function findUserByEmail(email) {
  if (dbType === 'mongo') {
    return getUserCollection().findOne({ email });
  }
  const { rows } = await postgresPool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  if (dbType === 'mongo') {
    return getUserCollection().findOne({ id });
  }
  const { rows } = await postgresPool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser({ name, email, password, role }) {
  const id = generateId();
  const record = { id, name: name || '', email, password, role: role || 'user', created_at: new Date() };
  if (dbType === 'mongo') {
    await getUserCollection().insertOne(record);
    return record;
  }
  await postgresPool.query(
    'INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, record.name, email, password, record.role, record.created_at]
  );
  return record;
}

async function createRefreshToken({ userId, token, expiresAt }) {
  const id = generateId();
  const record = { id, token, user_id: userId, expires_at: expiresAt, revoked_at: null, created_at: new Date() };

  if (dbType === 'mongo') {
    await getRefreshCollection().insertOne({ id, token, userId, expiresAt, revokedAt: null, createdAt: new Date() });
    return { id, token, userId, expiresAt, revokedAt: null, createdAt: record.created_at };
  }

  await postgresPool.query(
    'INSERT INTO refresh_tokens (id, token, user_id, expires_at, revoked_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, token, userId, expiresAt, null, record.created_at]
  );
  return { id, token, userId, expiresAt, revokedAt: null, createdAt: record.created_at };
}

async function findRefreshToken(token) {
  if (dbType === 'mongo') {
    return getRefreshCollection().findOne({ token });
  }
  const { rows } = await postgresPool.query('SELECT * FROM refresh_tokens WHERE token = $1', [token]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

async function revokeRefreshToken(token) {
  const revokedAt = new Date();
  if (dbType === 'mongo') {
    await getRefreshCollection().updateOne({ token }, { $set: { revokedAt } });
    return;
  }
  await postgresPool.query('UPDATE refresh_tokens SET revoked_at = $1 WHERE token = $2', [revokedAt, token]);
}

async function revokeUserRefreshTokens(userId) {
  const revokedAt = new Date();
  if (dbType === 'mongo') {
    await getRefreshCollection().updateMany({ userId }, { $set: { revokedAt } });
    return;
  }
  await postgresPool.query('UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2', [revokedAt, userId]);
}

async function closeDb() {
  if (dbType === 'mongo') {
    await mongoClient?.close();
    return;
  }
  await postgresPool?.end();
}

module.exports = {
  initDb,
  findUserByEmail,
  findUserById,
  createUser,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  closeDb,
};
