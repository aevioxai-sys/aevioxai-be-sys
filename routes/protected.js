const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

router.get('/user', authenticateJWT, authorizeRoles('user', 'admin'), (req, res) => {
  res.json({ message: 'Hello User', user: req.user });
});

router.get('/admin', authenticateJWT, authorizeRoles('admin'), (req, res) => {
  res.json({ message: 'Hello Admin', user: req.user });
});

module.exports = router;
