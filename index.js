const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./lib/db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);

app.get('/', (req, res) => res.json({ ok: true, message: 'Auth API running' }));

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database initialization failed', err);
    process.exit(1);
  });

module.exports = app;
