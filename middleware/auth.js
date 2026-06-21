const jwt = require('jsonwebtoken');
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'change_this_secret';

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function authorizeRoles(...allowed) {
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if (!role) return res.status(403).json({ message: 'No role' });
    if (!allowed.includes(role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { authenticateJWT, authorizeRoles };
