const express = require('express');
const pool = require('../database');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// Dashboard admin
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    // Estadísticas generales
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status IN ('played', 'confirmed', 'edited') THEN 1 END) as played_matches,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as pending_matches,
        COUNT(CASE WHEN status = 'played' AND is_confirmed = false THEN 1 END) as unconfirmed_matches
      FROM matches
    `);

    // Próximos partidos
    const upcoming = await pool.query(`
      SELECT 
        m.match_number, m.match_date AT TIME ZONE 'America/Argentina/Buenos_Aires' as match_date,
        m.stadium, m.city,
        hc.name as home_name, hc.flag_emoji as home_flag,
        ac.name as away_name, ac.flag_emoji as away_flag
      FROM matches m
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      WHERE m.status = 'scheduled' AND m.match_date > CURRENT_TIMESTAMP
      ORDER BY m.match_date ASC
      LIMIT 5
    `);

    // Últimos resultados
    const recent = await pool.query(`
      SELECT 
        m.match_number, m.home_score, m.away_score,
        m.updated_at AT TIME ZONE 'America/Argentina/Buenos_Aires' as updated_at,
        hc.name as home_name, hc.flag_emoji as home_flag,
        ac.name as away_name, ac.flag_emoji as away_flag,
        u.name as updated_by
      FROM matches m
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      LEFT JOIN users u ON m.confirmed_by = u.id
      WHERE m.status IN ('played', 'confirmed', 'edited')
      ORDER BY m.updated_at DESC
      LIMIT 5
    `);

    // Historial de cambios recientes
    const history = await pool.query(`
      SELECT 
        rh.*, m.match_number,
        u.name as edited_by_name,
        hc.name as home_name, ac.name as away_name
      FROM result_history rh
      JOIN matches m ON rh.match_id = m.id
      JOIN users u ON rh.edited_by_user_id = u.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      ORDER BY rh.created_at DESC
      LIMIT 10
    `);

    // Gestión de usuarios
    const users = await pool.query(`
      SELECT id, name, email, role, created_at 
      FROM users ORDER BY created_at DESC
    `);

    res.json({
      stats: stats.rows[0],
      upcoming_matches: upcoming.rows,
      recent_results: recent.rows,
      recent_history: history.rows,
      users: users.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar dashboard' });
  }
});

// Cambiar rol de usuario
router.put('/users/:userId/role', auth, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    res.json({ message: 'Rol actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});


// Desactivar usuario
router.delete('/users/:userId', auth, adminOnly, async (req, res) => {
  let statusCode = 200;
  let response = { message: 'Usuario eliminado correctamente' };

  try {
    const { userId } = req.params;

    const targetUserId = Number(userId);
    const currentUserId = Number(req.user.id);

    if (targetUserId === currentUserId) {
      statusCode = 400;
      response = { error: 'No podés eliminar tu propia cuenta administradora' };
    } else {
      const targetResult = await pool.query(
        'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
        [targetUserId]
      );

      if (targetResult.rows.length === 0) {
        statusCode = 404;
        response = { error: 'Usuario no encontrado' };
      } else {
        const targetUser = targetResult.rows[0];

        if (targetUser.role === 'admin') {
          const adminCount = await pool.query(
            "SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin' AND is_active = true AND id <> $1",
            [targetUserId]
          );

          if (adminCount.rows[0].total === 0) {
            statusCode = 400;
            response = { error: 'Debe quedar al menos una cuenta administradora activa' };
          } else {
            await pool.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
          }
        } else {
          await pool.query('UPDATE users SET is_active = false WHERE id = $1', [targetUserId]);
        }
      }
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    statusCode = 500;
    response = { error: 'Error al eliminar usuario' };
  }

  res.status(statusCode).json(response);
});


module.exports = router;
