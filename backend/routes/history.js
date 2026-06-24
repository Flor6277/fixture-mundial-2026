const express = require('express');
const pool = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.match_number,
        m.phase,
        m.status,
        m.home_score,
        m.away_score,
        m.home_penalties,
        m.away_penalties,
        m.is_confirmed,
        m.updated_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS updated_at,
        hc.name AS home_name,
        hc.flag_emoji AS home_flag,
        ac.name AS away_name,
        ac.flag_emoji AS away_flag,
        wc.name AS winner_name,
        u.name AS confirmed_by_name
      FROM matches m
      LEFT JOIN countries hc ON hc.id = m.home_country_id
      LEFT JOIN countries ac ON ac.id = m.away_country_id
      LEFT JOIN countries wc ON wc.id = m.winner_country_id
      LEFT JOIN users u ON u.id = m.confirmed_by
      WHERE m.status IN ('played','confirmed','edited')
      ORDER BY m.updated_at DESC, m.match_number DESC
    `);

    const edits = await pool.query(`
      SELECT
        rh.*,
        m.match_number,
        u.name AS edited_by_name,
        hc.name AS home_name,
        ac.name AS away_name
      FROM result_history rh
      JOIN matches m ON m.id = rh.match_id
      JOIN users u ON u.id = rh.edited_by_user_id
      LEFT JOIN countries hc ON hc.id = m.home_country_id
      LEFT JOIN countries ac ON ac.id = m.away_country_id
      ORDER BY rh.created_at DESC
      LIMIT 100
    `);

    res.json({ results: result.rows, edits: edits.rows });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
