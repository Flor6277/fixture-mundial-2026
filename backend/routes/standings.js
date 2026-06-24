const express = require('express');
const pool = require('../database');
const { auth } = require('../middleware/auth');
const { calcularMejoresTerceros } = require('../utils/tournament');
const router = express.Router();

// Tablas de posiciones por grupo
router.get('/groups', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*, g.name as group_name,
        c.name as country_name, c.flag_emoji, c.fifa_code
      FROM standings s
      JOIN groups g ON s.group_id = g.id
      JOIN countries c ON s.country_id = c.id
      ORDER BY g.name, s.position
    `);

    const liveResult = await pool.query(`
      SELECT
        m.id,
        m.match_number,
        g.name AS group_name,
        m.live_status,
        m.live_minute,
        m.live_second,
        m.live_home_score,
        m.live_away_score,
        hc.id AS home_country_id,
        hc.name AS home_name,
        ac.id AS away_country_id,
        ac.name AS away_name
      FROM matches m
      JOIN groups g ON m.group_id = g.id
      JOIN countries hc ON m.home_country_id = hc.id
      JOIN countries ac ON m.away_country_id = ac.id
      WHERE m.live_status = 'live'
    `);

    const liveMatches = {};
    for (const row of liveResult.rows) {
      liveMatches[row.group_name] = row;
    }

    const groups = {};
    for (const row of result.rows) {
      const liveMatch = liveMatches[row.group_name] || null;

      if (liveMatch) {
        if (row.country_id === liveMatch.home_country_id) {
          row.live_score_label = `${liveMatch.live_home_score} - ${liveMatch.live_away_score}`;
          row.live_minute = liveMatch.live_minute;
          row.live_second = liveMatch.live_second;
        }

        if (row.country_id === liveMatch.away_country_id) {
          row.live_score_label = `${liveMatch.live_home_score} - ${liveMatch.live_away_score}`;
          row.live_minute = liveMatch.live_minute;
          row.live_second = liveMatch.live_second;
        }
      }

      if (!groups[row.group_name]) groups[row.group_name] = [];
      groups[row.group_name].push(row);
    }

    res.json({ standings: groups, liveMatches });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tablas' });
  }
});

// Tabla específica de un grupo
router.get('/group/:groupName', auth, async (req, res) => {
  try {
    const { groupName } = req.params;

    const result = await pool.query(`
      SELECT 
        s.*, g.name as group_name,
        c.name as country_name, c.flag_emoji, c.fifa_code
      FROM standings s
      JOIN groups g ON s.group_id = g.id
      JOIN countries c ON s.country_id = c.id
      WHERE g.name = $1
      ORDER BY s.position
    `, [groupName]);

    res.json({ 
      group: groupName,
      standings: result.rows 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tabla del grupo' });
  }
});

// Mejores terceros
router.get('/third-places', auth, async (req, res) => {
  try {
    const terceros = await calcularMejoresTerceros();

    res.json({ thirdPlaces: terceros });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mejores terceros' });
  }
});

module.exports = router;
