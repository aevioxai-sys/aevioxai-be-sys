const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  findUserByEmail,
  findUserById,
  createUser,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
} = require('../lib/db');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'change_this_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || ACCESS_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

function signAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

async function createTokensForUser(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + msToMillis(REFRESH_TOKEN_EXPIRY));
  await createRefreshToken({ userId: user.id, token: refreshToken, expiresAt });
  return { accessToken, refreshToken };
}

function msToMillis(expiry) {
  if (typeof expiry === 'number') return expiry;
  const match = /^([0-9]+)([smhd])$/.exec(expiry);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 0);
}

function buildUserResponse(user) {
  return { id: user.id, email: user.email, name: user.name || '', role: user.role };
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const normalizedEmail = email.toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await createUser({ name: name || '', email: normalizedEmail, password: hashed, role: role || 'user' });
    const tokens = await createTokensForUser(user);
    res.status(201).json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: buildUserResponse(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const user = await findUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const tokens = await createTokensForUser(user);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: buildUserResponse(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const existing = await findRefreshToken(refreshToken);
    if (!existing || existing.revokedAt || new Date(existing.expiresAt) <= new Date()) {
      return res.status(401).json({ message: 'Refresh token expired or revoked' });
    }

    const user = await findUserById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const tokens = await createTokensForUser(user);
    await revokeRefreshToken(refreshToken);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
    await revokeRefreshToken(refreshToken);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal error' });
  }
});

module.exports = router;
