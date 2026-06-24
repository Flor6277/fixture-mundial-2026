const fs = require('fs');
const path = require('path');
const pool = require('../database');

const APPLY = process.argv.includes('--apply');
const ICS_PATH = path.join(__dirname, '..', '..', 'mundial2026.ics');

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
  return text.replace(/\r?\n[ \t]/g, '');
}

function getField(eventText, field) {
  const line = eventText
    .split(/\r?\n/)
    .find(l => l.startsWith(field + ':') || l.startsWith(field + ';'));

  if (!line) return null;

  const index = line.indexOf(':');
  return index >= 0 ? line.slice(index + 1).trim() : null;
}

function parseUTCDate(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);

  if (!match) {
    throw new Error(`Formato DTSTART no soportado: ${value}`);
  }

  const [, y, mo, d, h, mi, s] = match;

  return new Date(Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  ));
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

  const get = type => parts.find(p => p.type === type).value;

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function cleanTeamName(value) {
  return value
    .replace(/\s*\(\d+\s*-\s*\d+\)\s*$/g, '')
    .replace(/[^\p{L}\p{N}\s&.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTeams(summary) {
  if (!summary || summary.includes('Winner') || summary.includes('Loser')) {
    return null;
  }

  const parts = summary.split(/\s+-\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const home = cleanTeamName(parts[0]);
  const away = cleanTeamName(parts[1]);

  const homeCode = TEAM_TO_CODE[home];
  const awayCode = TEAM_TO_CODE[away];

  if (!homeCode || !awayCode) {
    return {
      home,
      away,
      homeCode,
      awayCode,
      unresolved: true
    };
  }

  return {
    home,
    away,
    homeCode,
    awayCode,
    unresolved: false
  };
}

async function main() {
  if (!fs.existsSync(ICS_PATH)) {
    throw new Error(`No se encontró el archivo: ${ICS_PATH}`);
  }

  const raw = fs.readFileSync(ICS_PATH, 'utf8');
  const text = unfoldICS(raw);

  const events = text
    .split('BEGIN:VEVENT')
    .slice(1)
    .map(e => e.split('END:VEVENT')[0]);

  const updates = [];
  const unresolved = [];
  const notFound = [];
  let skipped = 0;

  for (const eventText of events) {
    const summary = getField(eventText, 'SUMMARY');
    const dtstart = getField(eventText, 'DTSTART');

    if (!summary || !dtstart) {
      skipped++;
      continue;
    }

    const teams = parseTeams(summary);

    if (!teams) {
      skipped++;
      continue;
    }

    if (teams.unresolved) {
      unresolved.push({ summary, teams });
      continue;
    }

    const argentinaDate = toArgentinaTimestamp(parseUTCDate(dtstart));

    const result = await pool.query(`
      SELECT
        m.id,
        m.match_number,
        m.match_date,
        hc.fifa_code AS home_code,
        ac.fifa_code AS away_code,
        hc.name AS home_name,
        ac.name AS away_name
      FROM matches m
      JOIN countries hc ON m.home_country_id = hc.id
      JOIN countries ac ON m.away_country_id = ac.id
      WHERE m.phase = 'group_stage'
        AND (
          (hc.fifa_code = $1 AND ac.fifa_code = $2)
          OR
          (hc.fifa_code = $2 AND ac.fifa_code = $1)
        )
    `, [teams.homeCode, teams.awayCode]);

    if (result.rows.length === 0) {
      notFound.push({
        summary,
        homeCode: teams.homeCode,
        awayCode: teams.awayCode,
        argentinaDate
      });
      continue;
    }

    if (result.rows.length > 1) {
      console.log(`ATENCIÓN: más de un partido encontrado para ${summary}`);
    }

    const match = result.rows[0];

    updates.push({
      id: match.id,
      match_number: match.match_number,
      summary,
      home_name: match.home_name,
      away_name: match.away_name,
      old_date: match.match_date,
      new_date: argentinaDate
    });
  }

  console.log('\nResumen');
  console.log('-------');
  console.log(`Eventos leídos: ${events.length}`);
  console.log(`Partidos de fase de grupos encontrados: ${updates.length}`);
  console.log(`Eventos ignorados/placeholders: ${skipped}`);
  console.log(`Equipos no reconocidos: ${unresolved.length}`);
  console.log(`Partidos no encontrados en BD: ${notFound.length}`);
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'PRUEBA, sin modificar BD'}`);

  console.log('\nPrimeros cambios detectados');
  console.log('--------------------------');

  for (const item of updates.slice(0, 20)) {
    console.log(
      `#${item.match_number} | ${item.home_name} - ${item.away_name} | ${item.old_date} => ${item.new_date}`
    );
  }

  if (unresolved.length > 0) {
    console.log('\nEquipos no reconocidos');
    console.log('----------------------');
    for (const item of unresolved.slice(0, 20)) {
      console.log(item.summary);
    }
  }

  if (notFound.length > 0) {
    console.log('\nPartidos no encontrados');
    console.log('-----------------------');
    for (const item of notFound.slice(0, 20)) {
      console.log(`${item.summary} => ${item.argentinaDate}`);
    }
  }

  if (APPLY) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const item of updates) {
        await client.query(
          'UPDATE matches SET match_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.new_date, item.id]
        );
      }

      await client.query('COMMIT');
      console.log(`\nCambios aplicados correctamente: ${updates.length}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    console.log('\nNo se modificó la base. Para aplicar cambios, ejecutar con --apply');
  }

  await pool.end();
}

main().catch(error => {
  console.error('\nError:', error.message);
  process.exit(1);
});
