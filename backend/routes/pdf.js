const express = require('express');
const pool = require('../database');
const { auth, adminOnly } = require('../middleware/auth');
const { exportarPDF, generarHTMLFixture, generarHTMLTablas } = require('../utils/pdf');
const moment = require('moment-timezone');
const router = express.Router();

// Exportar fixture completo
router.get('/fixture', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.match_number, m.phase, m.status,
        m.home_score, m.away_score,
        m.match_date AT TIME ZONE 'America/Argentina/Buenos_Aires' as match_date,
        m.stadium, m.city,
        g.name as group_name,
        hc.name as home_name, hc.flag_emoji as home_flag,
        ac.name as away_name, ac.flag_emoji as away_flag,
        ks.slot_home_rule, ks.slot_away_rule
      FROM matches m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      LEFT JOIN knockout_slots ks ON m.match_number = ks.match_number
      ORDER BY m.match_number
    `);

    const now = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm');
    const html = generarHTMLFixture(result.rows, 'Fixture Completo - Mundial FIFA 2026', now);
    const pdf = await exportarPDF(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=fixture-mundial-2026.pdf');
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// Exportar tablas de posiciones
router.get('/standings', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*, g.name as group_name,
        c.name as country_name, c.flag_emoji
      FROM standings s
      JOIN groups g ON s.group_id = g.id
      JOIN countries c ON s.country_id = c.id
      ORDER BY g.name, s.position
    `);

    const standings = {};
    for (const row of result.rows) {
      if (!standings[row.group_name]) standings[row.group_name] = [];
      standings[row.group_name].push(row);
    }

    const now = moment().tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm');
    const html = generarHTMLTablas(standings, 'Tablas de Posiciones - Mundial FIFA 2026', now);
    const pdf = await exportarPDF(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=tablas-mundial-2026.pdf');
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar PDF' });
  }
});

module.exports = router;
