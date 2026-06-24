const express = require('express');
const pool = require('../database');
const { auth, adminOnly } = require('../middleware/auth');
const { matchResultValidation } = require('../middleware/validation');
const { calcularTablaGrupo, registrarHistorialResultado, recalcularTorneo } = require('../utils/tournament');
const router = express.Router();

// Obtener todos los partidos con filtros
router.get('/', auth, async (req, res) => {
  try {
    const { phase, group, country, status, date_from, date_to } = req.query;
    let query = `
      SELECT 
        m.id, m.match_number, m.phase, m.status, m.is_confirmed,
        m.home_score, m.away_score, m.home_penalties, m.away_penalties,
        m.match_date AT TIME ZONE 'America/Argentina/Buenos_Aires' as match_date,
        m.stadium, m.city,
        g.name as group_name,
        hc.name as home_name, hc.flag_emoji as home_flag, hc.fifa_code as home_code,
        ac.name as away_name, ac.flag_emoji as away_flag, ac.fifa_code as away_code,
        wc.name as winner_name,
        u.name as confirmed_by_name
      FROM matches m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      LEFT JOIN countries wc ON m.winner_country_id = wc.id
      LEFT JOIN users u ON m.confirmed_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (phase) {
      params.push(phase);
      query += ` AND m.phase = $${++paramCount}`;
    }
    if (group) {
      params.push(group);
      query += ` AND g.name = $${++paramCount}`;
    }
    if (country) {
      paramCount += 2;
      query += ` AND (hc.name ILIKE $${paramCount-1} OR ac.name ILIKE $${paramCount})`;
      params.push(`%${country}%`, `%${country}%`);
    }
    if (status) {
      params.push(status);
      query += ` AND m.status = $${++paramCount}`;
    }
    if (date_from && date_to) {
      params.push(date_from, date_to);
      query += ` AND m.match_date BETWEEN $${++paramCount} AND $${++paramCount}`;
    }

    query += ` ORDER BY m.match_date ASC, m.match_number ASC`;

    const result = await pool.query(query, params);
    res.json({ matches: result.rows });
  } catch (error) {
    console.error('Error al obtener partidos:', error);
    res.status(500).json({ error: 'Error al obtener partidos' });
  }
});



// Obtener partido destacado para Inicio
router.get('/featured', auth, async (req, res) => {
  try {
    const baseSelect = `
      SELECT
        m.id,
        m.match_number,
        m.phase,
        m.status,
        m.live_status,
        m.live_minute,
        m.live_second,
        m.live_home_score,
        m.live_away_score,
        m.home_score,
        m.away_score,
        m.match_date AT TIME ZONE 'America/Argentina/Buenos_Aires' as match_date,
        g.name as group_name,
        hc.name as home_name,
        ac.name as away_name
      FROM matches m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
    `;

    let result = await pool.query(baseSelect + `
      WHERE m.live_status = 'live'
      ORDER BY m.match_date ASC, m.match_number ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return res.json({ match: { ...result.rows[0], feature_status: 'live' } });
    }

    result = await pool.query(baseSelect + `
      WHERE m.live_status = 'live'
         OR (
          m.status = 'scheduled'
          AND m.match_date IS NOT NULL
          AND m.match_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND m.match_date + INTERVAL '115 minutes' >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
        )
      ORDER BY m.match_date ASC, m.match_number ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const match = result.rows[0];
      const estimatedMinute = match.live_minute ?? Math.max(
        0,
        Math.floor((new Date() - new Date(match.match_date)) / 60000)
      );

      return res.json({
        match: {
          ...match,
          feature_status: 'live',
          estimated_live: match.live_status !== 'live',
          live_minute: estimatedMinute,
          live_second: match.live_second ?? 0,
          live_home_score: match.live_home_score ?? match.home_score ?? 0,
          live_away_score: match.live_away_score ?? match.away_score ?? 0
        }
      });
    }

    result = await pool.query(baseSelect + `
      WHERE m.live_status = 'finished'
      ORDER BY m.updated_at DESC, m.match_number ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return res.json({ match: { ...result.rows[0], feature_status: 'finished' } });
    }

    result = await pool.query(baseSelect + `
      WHERE m.status = 'scheduled'
        AND m.match_date IS NOT NULL
        AND m.match_date >= CURRENT_TIMESTAMP
      ORDER BY m.match_date ASC, m.match_number ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return res.json({ match: { ...result.rows[0], feature_status: 'upcoming' } });
    }

    result = await pool.query(baseSelect + `
      WHERE m.status = 'scheduled'
      ORDER BY m.match_date ASC, m.match_number ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      return res.json({ match: { ...result.rows[0], feature_status: 'upcoming' } });
    }

    res.json({ match: null });
  } catch (error) {
    console.error('Error al obtener partido destacado:', error);
    res.status(500).json({ error: 'Error al obtener partido destacado' });
  }
});

// Obtener partidos en vivo
router.get('/live/current', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.match_number,
        m.phase,
        m.status,
        m.live_status,
        m.live_minute,
        m.live_second,
        m.live_home_score,
        m.live_away_score,
        m.match_date AT TIME ZONE 'America/Argentina/Buenos_Aires' as match_date,
        g.name as group_name,
        hc.name as home_name,
        ac.name as away_name
      FROM matches m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      WHERE m.live_status = 'live'
      ORDER BY m.match_date ASC, m.match_number ASC
    `);

    res.json({ matches: result.rows });
  } catch (error) {
    console.error('Error al obtener partidos en vivo:', error);
    res.status(500).json({ error: 'Error al obtener partidos en vivo' });
  }
});


// Finalizar partido en vivo
router.post('/:matchNumber/live/finish', auth, async (req, res) => {
  const client = await pool.connect();

  let statusCode = 200;
  let response = null;
  let transactionStarted = false;

  try {
    const { matchNumber } = req.params;

    if (req.user.role !== 'admin') {
      statusCode = 403;
      response = { error: 'Solo un administrador puede finalizar partidos en vivo' };
    } else {
      await client.query('BEGIN');
      transactionStarted = true;

      const matchResult = await client.query(
        'SELECT * FROM matches WHERE match_number = $1 FOR UPDATE',
        [matchNumber]
      );

      if (matchResult.rows.length === 0) {
        statusCode = 404;
        response = { error: 'Partido no encontrado' };
      } else {
        const match = matchResult.rows[0];

        if (match.live_home_score === null || match.live_away_score === null) {
          statusCode = 400;
          response = { error: 'No se puede finalizar un partido en vivo sin marcador parcial' };
        } else {
          const updateResult = await client.query(`
            UPDATE matches
            SET home_score = live_home_score,
                away_score = live_away_score,
                status = 'played',
                live_status = 'finished',
                live_minute = NULL,
                live_second = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE match_number = $1
            RETURNING *
          `, [matchNumber]);

          response = {
            message: 'Partido en vivo finalizado correctamente',
            match: updateResult.rows[0]
          };
        }
      }

      if (statusCode >= 400) {
        await client.query('ROLLBACK');
        transactionStarted = false;
      } else {
        await client.query('COMMIT');
        transactionStarted = false;

        if (response.match.group_id) {
          await calcularTablaGrupo(response.match.group_id);
        }
      }
    }
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    console.error('Error al finalizar partido en vivo:', error);
    statusCode = 500;
    response = { error: 'Error al finalizar partido en vivo' };
  } finally {
    client.release();
  }

  res.status(statusCode).json(response);
});

// Obtener un partido específico
router.get('/:matchNumber', auth, async (req, res) => {
  try {
    const { matchNumber } = req.params;
    const result = await pool.query(`
      SELECT 
        m.*,
        g.name as group_name,
        hc.name as home_name, hc.flag_emoji as home_flag,
        ac.name as away_name, ac.flag_emoji as away_flag,
        wc.name as winner_name,
        lc.name as loser_name
      FROM matches m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN countries hc ON m.home_country_id = hc.id
      LEFT JOIN countries ac ON m.away_country_id = ac.id
      LEFT JOIN countries wc ON m.winner_country_id = wc.id
      LEFT JOIN countries lc ON m.loser_country_id = lc.id
      WHERE m.match_number = $1
    `, [matchNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    // Historial de cambios
    const history = await pool.query(`
      SELECT 
        rh.*,
        u.name as edited_by_name
      FROM result_history rh
      JOIN users u ON rh.edited_by_user_id = u.id
      WHERE rh.match_id = $1
      ORDER BY rh.created_at DESC
    `, [result.rows[0].id]);

    res.json({ 
      match: result.rows[0],
      history: history.rows 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener partido' });
  }
});

// Cargar resultado (solo admin)
router.post('/:matchNumber/result', auth, adminOnly, matchResultValidation, async (req, res) => {
  const client = await pool.connect();
  try {
    const { matchNumber } = req.params;
    const { home_score, away_score, home_penalties, away_penalties, reason } = req.body;

    await client.query('BEGIN');

    // Verificar partido existe
    const matchResult = await client.query('SELECT * FROM matches WHERE match_number = $1', [matchNumber]);
    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const match = matchResult.rows[0];

    // Validar fase eliminatoria
    if (match.phase !== 'group_stage') {
      if (home_score === away_score) {
        if (!home_penalties || !away_penalties || home_penalties === away_penalties) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'En fase eliminatoria, los partidos empatados requieren definición por penales con ganador' 
          });
        }
      }
    }

    // Guardar historial si ya tenía resultado
    if (match.home_score !== null || match.away_score !== null) {
      await client.query(`
        INSERT INTO result_history 
        (match_id, edited_by_user_id, previous_home_score, previous_away_score, 
         new_home_score, new_away_score, previous_home_penalties, previous_away_penalties,
         new_home_penalties, new_away_penalties, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [match.id, req.user.id, match.home_score, match.away_score, 
          home_score, away_score, match.home_penalties, match.away_penalties,
          home_penalties, away_penalties, reason || 'Carga inicial']);
    }

    // Determinar ganador
    let winnerId = null;
    let loserId = null;
    
    if (match.phase === 'group_stage') {
      winnerId = null; // En grupos no hay ganador único
    } else {
      if (home_score > away_score) {
        winnerId = match.home_country_id;
        loserId = match.away_country_id;
      } else if (away_score > home_score) {
        winnerId = match.away_country_id;
        loserId = match.home_country_id;
      } else {
        // Por penales
        if (home_penalties > away_penalties) {
          winnerId = match.home_country_id;
          loserId = match.away_country_id;
        } else {
          winnerId = match.away_country_id;
          loserId = match.home_country_id;
        }
      }
    }

    // Actualizar partido
    await client.query(`
      UPDATE matches 
      SET home_score = $1, away_score = $2, home_penalties = $3, away_penalties = $4,
          winner_country_id = $5, loser_country_id = $6, status = 'played', updated_at = CURRENT_TIMESTAMP
      WHERE match_number = $7
    `, [home_score, away_score, home_penalties, away_penalties, winnerId, loserId, matchNumber]);

    await client.query('COMMIT');

    // Recalcular tabla si es fase de grupos
    if (match.group_id) {
      await calcularTablaGrupo(match.group_id);
    }

    res.json({ 
      message: 'Resultado cargado correctamente',
      match: matchNumber,
      home_score,
      away_score
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cargar resultado:', error);
    res.status(500).json({ error: 'Error al cargar resultado' });
  } finally {
    client.release();
  }
});

// Confirmar resultado (solo admin)
router.post('/:matchNumber/confirm', auth, adminOnly, async (req, res) => {
  try {
    const { matchNumber } = req.params;
    
    const result = await pool.query(`
      UPDATE matches 
      SET is_confirmed = true, status = 'confirmed', confirmed_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE match_number = $2 AND home_score IS NOT NULL
      RETURNING *
    `, [req.user.id, matchNumber]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No se puede confirmar un partido sin resultado' });
    }

    // Recalcular todo el torneo
    await recalcularTorneo();

    res.json({ message: 'Resultado confirmado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al confirmar resultado' });
  }
});

// Editar resultado (solo admin)
router.put('/:matchNumber/result', auth, adminOnly, matchResultValidation, async (req, res) => {
  const client = await pool.connect();
  try {
    const { matchNumber } = req.params;
    const { home_score, away_score, home_penalties, away_penalties, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Debe proporcionar un motivo de edición (mínimo 5 caracteres)' });
    }

    await client.query('BEGIN');

    const matchResult = await client.query('SELECT * FROM matches WHERE match_number = $1', [matchNumber]);
    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    const match = matchResult.rows[0];

    // Guardar historial
    await client.query(`
      INSERT INTO result_history 
      (match_id, edited_by_user_id, previous_home_score, previous_away_score, 
       new_home_score, new_away_score, previous_home_penalties, previous_away_penalties,
       new_home_penalties, new_away_penalties, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [match.id, req.user.id, match.home_score, match.away_score, 
        home_score, away_score, match.home_penalties, match.away_penalties,
        home_penalties, away_penalties, reason]);

    // Determinar nuevo ganador
    let winnerId = null;
    let loserId = null;
    
    if (match.phase !== 'group_stage') {
      if (home_score > away_score) {
        winnerId = match.home_country_id;
        loserId = match.away_country_id;
      } else if (away_score > home_score) {
        winnerId = match.away_country_id;
        loserId = match.home_country_id;
      } else {
        if (home_penalties > away_penalties) {
          winnerId = match.home_country_id;
          loserId = match.away_country_id;
        } else {
          winnerId = match.away_country_id;
          loserId = match.home_country_id;
        }
      }
    }

    await client.query(`
      UPDATE matches 
      SET home_score = $1, away_score = $2, home_penalties = $3, away_penalties = $4,
          winner_country_id = $5, loser_country_id = $6, status = 'edited', is_confirmed = false
      WHERE match_number = $7
    `, [home_score, away_score, home_penalties, away_penalties, winnerId, loserId, matchNumber]);

    await client.query('COMMIT');

    // Recalcular
    if (match.group_id) {
      await calcularTablaGrupo(match.group_id);
    }
    await recalcularTorneo();

    res.json({ 
      message: 'Resultado editado correctamente. Los cruces y clasificados pueden haber cambiado.',
      warning: 'Este cambio modificará cruces ya generados si el torneo avanzó.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al editar resultado' });
  } finally {
    client.release();
  }
});

module.exports = router;
