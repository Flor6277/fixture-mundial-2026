const express = require('express');
const pool = require('../database');
const { auth, adminOnly } = require('../middleware/auth');
const { avanzarGanador } = require('../utils/tournament');
const router = express.Router();

// Obtener bracket completo
router.get('/bracket', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ks.*,
        hc.name as home_name, hc.flag_emoji as home_flag,
        ac.name as away_name, ac.flag_emoji as away_flag,
        m.home_score, m.away_score, m.home_penalties, m.away_penalties,
        m.status as match_status, m.is_confirmed, m.match_date,
        m.stadium, m.city,
        wc.name as winner_name
      FROM knockout_slots ks
      LEFT JOIN matches m ON ks.match_number = m.match_number
      LEFT JOIN countries hc ON COALESCE(ks.home_country_id, m.home_country_id) = hc.id
      LEFT JOIN countries ac ON COALESCE(ks.away_country_id, m.away_country_id) = ac.id
      LEFT JOIN countries wc ON m.winner_country_id = wc.id
      ORDER BY ks.match_number
    `);

    const phases = {
      round_of_32: [],
      round_of_16: [],
      quarterfinal: [],
      semifinal: [],
      third_place: [],
      final: []
    };

    for (const row of result.rows) {
      if (phases[row.phase]) {
        phases[row.phase].push(row);
      }
    }

    res.json({ bracket: phases });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener bracket' });
  }
});

// Confirmar ganador y avanzar (solo admin)
router.post('/match/:matchNumber/advance', auth, adminOnly, async (req, res) => {
  try {
    const { matchNumber } = req.params;
    const { winner_id } = req.body;

    const matchResult = await pool.query(`
      SELECT * FROM matches WHERE match_number = $1
    `, [matchNumber]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const match = matchResult.rows[0];
    const loserId = match.home_country_id === winner_id ? match.away_country_id : match.home_country_id;

    const result = await avanzarGanador(parseInt(matchNumber), winner_id, loserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al avanzar ganador' });
  }
});

module.exports = router;
