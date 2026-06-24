const pool = require('../database');
const { recalcularTodasLasTablas } = require('../utils/tournament');

const TEAM_TO_CODE = {
  'Mexico': 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czechia': 'CZE',
  'Canada': 'CAN',
  'Bosnia and Herzegovina': 'BIH',
  'Qatar': 'QAT',
  'Switzerland': 'SUI',
  'Brazil': 'BRA',
  'Morocco': 'MAR',
  'Haiti': 'HTI',
  'Scotland': 'SCO',
  'USA': 'USA',
  'United States': 'USA',
  'Paraguay': 'PAR',
  'Australia': 'AUS',
  'Turkey': 'TUR',
  'Turkiye': 'TUR',
  'Türkiye': 'TUR',
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
  'Congo DR': 'COD',
  'Democratic Republic of the Congo': 'COD',
  'Uzbekistan': 'UZB',
  'Colombia': 'COL',
  'England': 'ENG',
  'Croatia': 'CRO',
  'Ghana': 'GHA',
  'Panama': 'PAN'
};

function unfoldICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return unfolded;
}

function getField(eventText, field) {
  let value = null;
  const lines = eventText.split(/\r?\n/);

  for (const line of lines) {
    if (value === null) {
      const startsSimple = line.startsWith(field + ':');
      const startsWithParams = line.startsWith(field + ';');

      if (startsSimple || startsWithParams) {
        const index = line.indexOf(':');

        if (index >= 0) {
          value = line.slice(index + 1).trim();
        }
      }
    }
  }

  return value;
}

function parseUTCDate(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  let date = null;

  if (!match) {
    throw new Error(`Formato DTSTART no soportado: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  date = new Date(Date.UTC(year, month, day, hour, minute, second));

  return date;
}

function toArgentinaTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  const timestamp = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;

  return timestamp;
}

function cleanTeamName(value) {
  const cleaned = String(value || '')
    .replace(/\s*\(\d+\s*-\s*\d+\)\s*$/g, '')
    .replace(/[^\p{L}\p{N}\s&.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function parseScore(summary) {
  let score = null;
  const match = String(summary || '').match(/\((\d+)\s*-\s*(\d+)\)\s*$/);

  if (match) {
    score = {
      homeScore: Number(match[1]),
      awayScore: Number(match[2])
    };
  }

  return score;
}

function parseTeams(summary) {
  let teams = null;
  const text = String(summary || '');
  const isPlaceholder = text.includes('Winner') || text.includes('Loser');

  if (!isPlaceholder) {
    const parts = text.split(/\s+-\s+/);

    if (parts.length === 2) {
      const home = cleanTeamName(parts[0]);
      const away = cleanTeamName(parts[1]);
      const homeCode = TEAM_TO_CODE[home] || null;
      const awayCode = TEAM_TO_CODE[away] || null;

      teams = {
        home,
        away,
        homeCode,
        awayCode,
        unresolved: !homeCode || !awayCode
      };
    }
  }

  return teams;
}

function parseEvents(rawICS) {
  const text = unfoldICS(rawICS);
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  const events = [];

  for (const block of blocks) {
    const eventText = block.split('END:VEVENT')[0];
    const summary = getField(eventText, 'SUMMARY');
    const dtstart = getField(eventText, 'DTSTART');

    events.push({
      summary,
      dtstart
    });
  }

  return events;
}

async function downloadCalendar(url) {
  let text = '';

  if (!url) {
    throw new Error('Falta WORLD_CUP_CALENDAR_URL en el archivo .env');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Esta versión de Node no tiene fetch disponible');
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar el calendario. Estado HTTP: ${response.status}`);
  }

  text = await response.text();

  return text;
}

async function createSyncLog(client) {
  const result = await client.query(`
    INSERT INTO sync_logs (status, source, message)
    VALUES ('started', 'calendar_ics', 'Sincronización iniciada')
    RETURNING id
  `);

  return result.rows[0].id;
}

async function updateSyncLog(client, logId, summary, status, message) {
  await client.query(`
    UPDATE sync_logs
    SET status = $1,
        events_read = $2,
        matches_updated = $3,
        results_detected = $4,
        message = $5,
        details = $6,
        finished_at = CURRENT_TIMESTAMP
    WHERE id = $7
  `, [
    status,
    summary.eventsRead,
    summary.matchesUpdated,
    summary.resultsDetected,
    message,
    JSON.stringify(summary),
    logId
  ]);
}

async function findGroupMatch(client, homeCode, awayCode) {
  const result = await client.query(`
    SELECT
      m.id,
      m.match_number,
      m.home_score,
      m.away_score,
      m.is_confirmed,
      hc.fifa_code AS home_code,
      ac.fifa_code AS away_code
    FROM matches m
    JOIN countries hc ON m.home_country_id = hc.id
    JOIN countries ac ON m.away_country_id = ac.id
    WHERE m.phase = 'group_stage'
      AND (
        (hc.fifa_code = $1 AND ac.fifa_code = $2)
        OR
        (hc.fifa_code = $2 AND ac.fifa_code = $1)
      )
    LIMIT 1
  `, [homeCode, awayCode]);

  let match = null;

  if (result.rows.length > 0) {
    match = result.rows[0];
  }

  return match;
}

async function updateMatchDate(client, matchId, newDate) {
  const result = await client.query(`
    UPDATE matches
    SET match_date = $1::timestamp,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
      AND match_date IS DISTINCT FROM $1::timestamp
  `, [newDate, matchId]);

  return result.rowCount;
}

async function updateMatchResult(client, match, teams, score) {
  let updated = 0;

  if (score && !match.is_confirmed) {
    const sameOrder = match.home_code === teams.homeCode && match.away_code === teams.awayCode;
    const homeScore = sameOrder ? score.homeScore : score.awayScore;
    const awayScore = sameOrder ? score.awayScore : score.homeScore;

    const currentHomeScore = match.home_score === null ? null : Number(match.home_score);
    const currentAwayScore = match.away_score === null ? null : Number(match.away_score);

    const scoreChanged = currentHomeScore !== homeScore || currentAwayScore !== awayScore;

    if (scoreChanged) {
      const result = await client.query(`
        UPDATE matches
        SET home_score = $1,
            away_score = $2,
            status = 'played',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
          AND is_confirmed = false
      `, [homeScore, awayScore, match.id]);

      updated = result.rowCount;
    }
  }

  return updated;
}

async function syncWorldCupCalendar() {
  const client = await pool.connect();
  let logId = null;

  const summary = {
    eventsRead: 0,
    matchesUpdated: 0,
    resultsDetected: 0,
    unresolvedEvents: [],
    notFoundEvents: []
  };

  try {
    logId = await createSyncLog(client);

    const url = process.env.WORLD_CUP_CALENDAR_URL;
    const rawICS = await downloadCalendar(url);
    const events = parseEvents(rawICS);
    const autoSyncResults = process.env.AUTO_SYNC_RESULTS === 'true';

    summary.eventsRead = events.length;

    for (const event of events) {
      const teams = parseTeams(event.summary);
      const validTeams = teams && !teams.unresolved && event.dtstart;

      if (validTeams) {
        const newDate = toArgentinaTimestamp(parseUTCDate(event.dtstart));
        const match = await findGroupMatch(client, teams.homeCode, teams.awayCode);

        if (match) {
          const dateUpdates = await updateMatchDate(client, match.id, newDate);
          summary.matchesUpdated += dateUpdates;

          if (autoSyncResults) {
            const score = parseScore(event.summary);
            const resultUpdates = await updateMatchResult(client, match, teams, score);
            summary.resultsDetected += resultUpdates;
          }
        } else {
          summary.notFoundEvents.push(event.summary);
        }
      } else {
        if (teams && teams.unresolved) {
          summary.unresolvedEvents.push(event.summary);
        }
      }
    }

    await updateSyncLog(client, logId, summary, 'success', 'Sincronización finalizada correctamente');

    if (summary.resultsDetected > 0) {
      await recalcularTodasLasTablas();
      console.log('Tablas recalculadas automáticamente por resultados detectados');
    }

    console.log('Sincronización del calendario finalizada');
    console.log(`Eventos leídos: ${summary.eventsRead}`);
    console.log(`Fechas actualizadas: ${summary.matchesUpdated}`);
    console.log(`Resultados detectados: ${summary.resultsDetected}`);
  } catch (error) {
    if (logId) {
      await updateSyncLog(client, logId, summary, 'error', error.message);
    }

    console.error('Error al sincronizar calendario:', error.message);
    throw error;
  } finally {
    client.release();
  }

  return summary;
}

module.exports = syncWorldCupCalendar;


