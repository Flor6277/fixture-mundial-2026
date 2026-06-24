const jwt = require('jsonwebtoken');
const pool = require('../database');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fixture_mundial_2026_dev_secret');
    const result = await pool.query(
      'SELECT id, name, email, role, created_at, is_active FROM users WHERE id = $1',
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso reservado para administradores' });
  }
  next();
};

module.exports = { auth, adminOnly };
