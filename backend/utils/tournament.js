const pool = require('../database');

const PHASES = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

async function calcularTablaGrupo(groupId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teamsResult = await client.query(`
      SELECT gt.country_id, c.name, c.fifa_code, c.flag_emoji
      FROM group_teams gt
      JOIN countries c ON c.id = gt.country_id
      WHERE gt.group_id = $1
      ORDER BY c.name
    `, [groupId]);

    const stats = new Map();
    for (const team of teamsResult.rows) {
      stats.set(team.country_id, {
        group_id: groupId,
        country_id: team.country_id,
        country_name: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        position: 0,
        status: 'pending'
      });
    }

    const matchesResult = await client.query(`
      SELECT * FROM matches
      WHERE group_id = $1 AND phase = 'group_stage'
      ORDER BY match_number
    `, [groupId]);

    for (const match of matchesResult.rows) {
      if (match.home_score === null || match.away_score === null) continue;
      const home = stats.get(match.home_country_id);
      const away = stats.get(match.away_country_id);
      if (!home || !away) continue;

      home.played += 1;
      away.played += 1;
      home.goals_for += Number(match.home_score);
      home.goals_against += Number(match.away_score);
      away.goals_for += Number(match.away_score);
      away.goals_against += Number(match.home_score);

      if (match.home_score > match.away_score) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (match.away_score > match.home_score) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const allPlayed = matchesResult.rows.length > 0 && matchesResult.rows.every(
      m => m.home_score !== null && m.away_score !== null
    );

    const rows = Array.from(stats.values()).map(row => ({
      ...row,
      goal_difference: row.goals_for - row.goals_against
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      if (a.goals_against !== b.goals_against) return a.goals_against - b.goals_against;
      return a.country_name.localeCompare(b.country_name);
    });

    rows.forEach((row, index) => {
      row.position = index + 1;
      if (allPlayed) {
        if (row.position === 1) row.status = 'qualified_1st';
        else if (row.position === 2) row.status = 'qualified_2nd';
        else if (row.position === 3) row.status = 'possible_third';
        else row.status = 'eliminated';
      }
    });

    await client.query('DELETE FROM standings WHERE group_id = $1', [groupId]);
    for (const row of rows) {
      await client.query(`
        INSERT INTO standings
        (group_id, country_id, played, won, drawn, lost, goals_for, goals_against,
         goal_difference, points, position, status, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)
      `, [
        row.group_id, row.country_id, row.played, row.won, row.drawn, row.lost,
        row.goals_for, row.goals_against, row.goal_difference, row.points,
        row.position, row.status
      ]);
    }

    await client.query('COMMIT');
    return rows;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al calcular tabla de grupo:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function recalcularTodasLasTablas() {
  const groups = await pool.query('SELECT id FROM groups ORDER BY name');
  for (const group of groups.rows) {
    await calcularTablaGrupo(group.id);
  }
}

async function calcularMejoresTerceros() {
  await recalcularTodasLasTablas();

  const result = await pool.query(`
    SELECT s.*, g.name AS group_name, c.name AS country_name, c.flag_emoji, c.fifa_code
    FROM standings s
    JOIN groups g ON g.id = s.group_id
    JOIN countries c ON c.id = s.country_id
    WHERE s.position = 3
    ORDER BY s.points DESC, s.goal_difference DESC, s.goals_for DESC, s.goals_against ASC, c.name ASC
  `);

  return result.rows.map((row, index) => ({
    ...row,
    classified: index < 8
  }));
}

async function definirClasificados() {
  await recalcularTodasLasTablas();
  const standings = await pool.query(`
    SELECT s.*, g.name AS group_name, c.name AS country_name, c.flag_emoji, c.fifa_code
    FROM standings s
    JOIN groups g ON g.id = s.group_id
    JOIN countries c ON c.id = s.country_id
    ORDER BY g.name, s.position
  `);

  const winners = {};
  const seconds = {};
  const thirds = [];

  for (const row of standings.rows) {
    if (row.position === 1) winners[row.group_name] = row;
    if (row.position === 2) seconds[row.group_name] = row;
    if (row.position === 3) thirds.push(row);
  }

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    if (a.goals_against !== b.goals_against) return a.goals_against - b.goals_against;
    return a.country_name.localeCompare(b.country_name);
  });

  return { winners, seconds, thirds: thirds.slice(0, 8), allThirds: thirds };
}

function parseGroupRule(rule) {
  const compact = String(rule || '').trim().toUpperCase();
  const short = compact.replace('GANADOR GRUPO ', '1').replace('SEGUNDO GRUPO ', '2').replace('TERCERO GRUPO ', '3');
  const match = short.match(/^([123])([A-L])$/);
  if (!match) return null;
  return { position: Number(match[1]), group: match[2] };
}

async function resolveSlotRule(rule, clasificados) {
  if (!rule) return null;
  const text = String(rule).trim();
  const upper = text.toUpperCase();

  const groupRule = parseGroupRule(text);
  if (groupRule) {
    if (groupRule.position === 1) return clasificados.winners[groupRule.group]?.country_id || null;
    if (groupRule.position === 2) return clasificados.seconds[groupRule.group]?.country_id || null;
    if (groupRule.position === 3) {
      const third = clasificados.allThirds.find(t => t.group_name === groupRule.group);
      return third?.country_id || null;
    }
  }

  const bestThird = upper.match(/MEJOR TERCERO\s*(\d+)/);
  if (bestThird) {
    const index = Number(bestThird[1]) - 1;
    return clasificados.thirds[index]?.country_id || null;
  }

  const winner = upper.match(/(?:GANADOR PARTIDO|W)\s*(\d+)/);
  if (winner) {
    const match = await pool.query('SELECT winner_country_id FROM matches WHERE match_number = $1', [Number(winner[1])]);
    return match.rows[0]?.winner_country_id || null;
  }

  const loser = upper.match(/(?:PERDEDOR PARTIDO|L)\s*(\d+)/);
  if (loser) {
    const match = await pool.query('SELECT loser_country_id FROM matches WHERE match_number = $1', [Number(loser[1])]);
    return match.rows[0]?.loser_country_id || null;
  }

  return null;
}

async function generarCrucesDieciseisavos() {
  const clasificados = await definirClasificados();
  const slots = await pool.query(`
    SELECT * FROM knockout_slots
    WHERE phase = 'round_of_32'
    ORDER BY match_number
  `);

  for (const slot of slots.rows) {
    const homeId = await resolveSlotRule(slot.slot_home_rule, clasificados);
    const awayId = await resolveSlotRule(slot.slot_away_rule, clasificados);

    await pool.query(`
      UPDATE knockout_slots
      SET home_country_id = $1, away_country_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [homeId, awayId, slot.id]);

    await pool.query(`
      UPDATE matches
      SET home_country_id = $1, away_country_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE match_number = $3
    `, [homeId, awayId, slot.match_number]);
  }
}

async function avanzarGanador(matchNumber, winnerId, loserId = null) {
  const match = await pool.query('SELECT * FROM matches WHERE match_number = $1', [matchNumber]);
  if (match.rows.length === 0) throw new Error('Partido no encontrado');

  await pool.query(`
    UPDATE matches
    SET winner_country_id = $1, loser_country_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE match_number = $3
  `, [winnerId, loserId, matchNumber]);

  const targetSlots = await pool.query(`
    SELECT * FROM knockout_slots
    WHERE UPPER(slot_home_rule) IN ($1, $2)
       OR UPPER(slot_away_rule) IN ($1, $2)
  `, [`GANADOR PARTIDO ${matchNumber}`, `W${matchNumber}`]);

  for (const slot of targetSlots.rows) {
    const isHome = [
      `GANADOR PARTIDO ${matchNumber}`,
      `W${matchNumber}`
    ].includes(String(slot.slot_home_rule).toUpperCase());

    const field = isHome ? 'home_country_id' : 'away_country_id';
    await pool.query(`UPDATE knockout_slots SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [winnerId, slot.id]);
    await pool.query(`UPDATE matches SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE match_number = $2`, [winnerId, slot.match_number]);
  }

  if (loserId) {
    const loserTargets = await pool.query(`
      SELECT * FROM knockout_slots
      WHERE UPPER(slot_home_rule) IN ($1, $2)
         OR UPPER(slot_away_rule) IN ($1, $2)
    `, [`PERDEDOR PARTIDO ${matchNumber}`, `L${matchNumber}`]);

    for (const slot of loserTargets.rows) {
      const isHome = [
        `PERDEDOR PARTIDO ${matchNumber}`,
        `L${matchNumber}`
      ].includes(String(slot.slot_home_rule).toUpperCase());

      const field = isHome ? 'home_country_id' : 'away_country_id';
      await pool.query(`UPDATE knockout_slots SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [loserId, slot.id]);
      await pool.query(`UPDATE matches SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE match_number = $2`, [loserId, slot.match_number]);
    }
  }

  return { message: 'Ganador avanzado correctamente', match_number: matchNumber, winner_id: winnerId };
}

async function recalcularTorneo() {
  await recalcularTodasLasTablas();

  const groupStage = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE home_score IS NOT NULL AND away_score IS NOT NULL)::int AS played
    FROM matches WHERE phase = 'group_stage'
  `);

  if (groupStage.rows[0].total === groupStage.rows[0].played) {
    await generarCrucesDieciseisavos();
  }

  const confirmedKnockout = await pool.query(`
    SELECT match_number, winner_country_id, loser_country_id
    FROM matches
    WHERE phase <> 'group_stage'
      AND is_confirmed = true
      AND winner_country_id IS NOT NULL
    ORDER BY match_number
  `);

  for (const match of confirmedKnockout.rows) {
    await avanzarGanador(match.match_number, match.winner_country_id, match.loser_country_id);
  }

  return { message: 'Torneo recalculado correctamente' };
}

async function registrarHistorialResultado({
  match_id,
  edited_by_user_id,
  previous_home_score,
  previous_away_score,
  new_home_score,
  new_away_score,
  previous_home_penalties = null,
  previous_away_penalties = null,
  new_home_penalties = null,
  new_away_penalties = null,
  reason = 'Actualización de resultado'
}) {
  return pool.query(`
    INSERT INTO result_history
    (match_id, edited_by_user_id, previous_home_score, previous_away_score,
     new_home_score, new_away_score, previous_home_penalties, previous_away_penalties,
     new_home_penalties, new_away_penalties, reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [
    match_id, edited_by_user_id, previous_home_score, previous_away_score,
    new_home_score, new_away_score, previous_home_penalties, previous_away_penalties,
    new_home_penalties, new_away_penalties, reason
  ]);
}

module.exports = {
  calcularTablaGrupo,
  recalcularTodasLasTablas,
  calcularMejoresTerceros,
  definirClasificados,
  generarCrucesDieciseisavos,
  avanzarGanador,
  recalcularTorneo,
  registrarHistorialResultado
};
