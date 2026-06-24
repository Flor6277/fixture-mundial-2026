const pool = require('../database');
const { recalcularTodasLasTablas } = require('../utils/tournament');
const https = require('https');

const WORLD_CUP_26_API_URL = process.env.WORLD_CUP_26_API_URL || 'https://worldcup26.ir/get/games';

const TEAM_TO_CODE = {
  'Mexico': 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  'Czechia': 'CZE',

  'Canada': 'CAN',
  'Bosnia and Herzegovina': 'BIH',
  'Qatar': 'QAT',
  'Switzerland': 'SUI',

  'Brazil': 'BRA',
  'Morocco': 'MAR',
  'Haiti': 'HTI',
  'Scotland': 'SCO',

  'United States': 'USA',
  'USA': 'USA',
  'Paraguay': 'PAR',
  'Australia': 'AUS',
  'Turkey': 'TUR',

  'Germany': 'GER',
  'Curacao': 'CUW',
  'Curaçao': 'CUW',
  'Ivory Coast': 'CIV',
  'Ecuador': 'ECU',

  'Netherlands': 'NED',
  'Japan': 'JPN',
  'Sweden': 'SWE',
  'Tunisia': 'TUN',

  'Belgium': 'BEL',
  'Egypt': 'EGY',
  'Iran': 'IRI',
  'New Zealand': 'NZL',

  'Spain': 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  'Uruguay': 'URU',

  'France': 'FRA',
  'Senegal': 'SEN',
  'Iraq': 'IRQ',
  'Norway': 'NOR',

  'Argentina': 'ARG',
  'Algeria': 'DZA',
  'Austria': 'AUT',
  'Jordan': 'JOR',

  'Portugal': 'POR',
  'DR Congo': 'COD',
  'Democratic Republic of the Congo': 'COD',
  'Uzbekistan': 'UZB',
  'Colombia': 'COL',

  'England': 'ENG',
  'Croatia': 'CRO',
  'Ghana': 'GHA',
  'Panama': 'PAN'
};

function downloadJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(new URL(url), { method: 'GET' }, response => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('La respuesta de worldcup26.ir no es JSON válido'));
        }
      });
    });

    request.on('error', error => {
      reject(error);
    });

    request.end();
  });
}

function normalizeFinished(value) {
  return String(value || '').toUpperCase() === 'TRUE';
}

function isNotStarted(value) {
  return String(value || '').toLowerCase() === 'notstarted';
}

function isFinishedText(value) {
  return String(value || '').toLowerCase() === 'finished';
}

function parseScore(value) {
  let result = null;

  if (value !== null && value !== undefined && value !== '') {
    const parsed = Number(value);

    if (!Number.isNaN(parsed)) {
      result = parsed;
    }
  }

  return result;
}

function parseMinute(value) {
  let result = null;
  const parsed = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);

  if (!Number.isNaN(parsed)) {
    result = parsed;
  }

  return result;
}

async function findLocalMatch(client, game) {
  const homeCode = TEAM_TO_CODE[game.home_team_name_en];
  const awayCode = TEAM_TO_CODE[game.away_team_name_en];

  let match = null;

  if (homeCode && awayCode && game.group) {
    const result = await client.query(`
      SELECT
        m.*,
        g.name AS group_name,
        hc.fifa_code AS home_code,
        ac.fifa_code AS away_code
      FROM matches m
      JOIN groups g ON g.id = m.group_id
      JOIN countries hc ON hc.id = m.home_country_id
      JOIN countries ac ON ac.id = m.away_country_id
      WHERE m.phase = 'group_stage'
        AND g.name = $1
        AND hc.fifa_code = $2
        AND ac.fifa_code = $3
      LIMIT 1
    `, [game.group, homeCode, awayCode]);

    if (result.rows.length > 0) {
      match = result.rows[0];
    }
  }

  return match;
}

async function updateFinishedMatch(client, match, game, summary) {
  const homeScore = parseScore(game.home_score);
  const awayScore = parseScore(game.away_score);

  if (homeScore !== null && awayScore !== null) {
    if (match.is_confirmed) {
      summary.confirmedSkipped += 1;
    } else {
      const result = await client.query(`
        UPDATE matches
        SET home_score = $1,
            away_score = $2,
            status = 'played',
            live_status = 'finished',
            live_minute = NULL,
            live_second = NULL,
            live_home_score = $1,
            live_away_score = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
          AND is_confirmed = false
          AND (
            home_score IS DISTINCT FROM $1 OR
            away_score IS DISTINCT FROM $2 OR
            status IS DISTINCT FROM 'played' OR
            live_status IS DISTINCT FROM 'finished'
          )
        RETURNING group_id
      `, [homeScore, awayScore, match.id]);

      if (result.rowCount > 0) {
        summary.finishedUpdated += 1;
        summary.groupsToRecalculate.add(result.rows[0].group_id);
      }
    }
  }
}

async function updateLiveMatch(client, match, game, summary) {
  const homeScore = parseScore(game.home_score);
  const awayScore = parseScore(game.away_score);
  const minute = parseMinute(game.time_elapsed);

  if (homeScore !== null && awayScore !== null && !match.is_confirmed) {
    const result = await client.query(`
      UPDATE matches
      SET live_status = 'live',
          live_minute = $1,
          live_second = 0,
          live_home_score = $2,
          live_away_score = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND is_confirmed = false
        AND (
          live_status IS DISTINCT FROM 'live' OR
          live_minute IS DISTINCT FROM $1 OR
          live_home_score IS DISTINCT FROM $2 OR
          live_away_score IS DISTINCT FROM $3
        )
    `, [minute, homeScore, awayScore, match.id]);

    if (result.rowCount > 0) {
      summary.liveUpdated += 1;
    }
  }
}

async function syncWorldCup26Api() {
  const client = await pool.connect();

  const summary = {
    gamesRead: 0,
    groupGamesRead: 0,
    finishedUpdated: 0,
    liveUpdated: 0,
    confirmedSkipped: 0,
    notFound: [],
    groupsToRecalculate: new Set()
  };

  try {
    const json = await downloadJson(WORLD_CUP_26_API_URL);
    const games = json.games || [];

    summary.gamesRead = games.length;

    for (const game of games) {
      if (game.type === 'group') {
        summary.groupGamesRead += 1;

        const match = await findLocalMatch(client, game);

        if (match) {
          const finished = normalizeFinished(game.finished);
          const statusText = String(game.time_elapsed || '').toLowerCase();

          if (finished || isFinishedText(statusText)) {
            await updateFinishedMatch(client, match, game, summary);
          } else if (!isNotStarted(statusText)) {
            await updateLiveMatch(client, match, game, summary);
          }
        } else {
          summary.notFound.push({
            id: game.id,
            group: game.group,
            home: game.home_team_name_en,
            away: game.away_team_name_en
          });
        }
      }
    }

    if (summary.finishedUpdated > 0) {
      await recalcularTodasLasTablas();
    }

    return {
      ...summary,
      groupsToRecalculate: Array.from(summary.groupsToRecalculate)
    };
  } finally {
    client.release();
  }
}

module.exports = syncWorldCup26Api;
