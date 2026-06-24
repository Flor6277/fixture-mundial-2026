require('dotenv').config();

const path = require('path');
const pool = require('../database');

const APPLY = process.argv.includes('--apply');
const CALENDAR_URL = process.env.WORLD_CUP_CALENDAR_URL;

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

  date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  ));

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

function cleanSummary(value) {
  const cleaned = String(value || '')
    .replace(/\\,/g, ',')
    .replace(/\s*\(\d+\s*-\s*\d+\)\s*$/g, '')
    .replace(/[^\p{L}\p{N}\s&.'\/-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function isSlotPart(value) {
  const text = String(value || '').trim();
  const result =
    /^[123][A-L]{1,6}(\/[123][A-L]{1,6})*$/.test(text) ||
    /^Winner\s+[A-Z]{1,3}\s+\d+$/i.test(text) ||
    /^Loser\s+[A-Z]{1,3}\s+\d+$/i.test(text);

  return result;
}

function splitKnockoutSummary(summary) {
  let result = null;
  const cleaned = cleanSummary(summary);
  const parts = cleaned.split(/\s+-\s+/);

  if (parts.length === 2) {
    result = {
      raw: summary,
      cleaned,
      homeRule: parts[0].trim(),
      awayRule: parts[1].trim()
    };
  }

  return result;
}

function isKnockoutSummary(summary) {
  let result = false;
  const split = splitKnockoutSummary(summary);

  if (split) {
    result = isSlotPart(split.homeRule) || isSlotPart(split.awayRule);
  }

  return result;
}

function parseEvents(rawICS) {
  const text = unfoldICS(rawICS);
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  const events = [];

  for (const block of blocks) {
    const eventText = block.split('END:VEVENT')[0];
    const summary = getField(eventText, 'SUMMARY');
    const dtstart = getField(eventText, 'DTSTART');

    if (summary && dtstart && isKnockoutSummary(summary)) {
      const split = splitKnockoutSummary(summary);
      const date = parseUTCDate(dtstart);

      events.push({
        summary,
        homeRule: split.homeRule,
        awayRule: split.awayRule,
        date,
        argentinaDate: toArgentinaTimestamp(date)
      });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

async function downloadCalendar(url) {
  let text = '';

  if (!url) {
    throw new Error('Falta WORLD_CUP_CALENDAR_URL en el archivo .env');
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar el calendario. HTTP ${response.status}`);
  }

  text = await response.text();

  return text;
}

async function getKnockoutMatches() {
  const result = await pool.query(`
    SELECT
      m.id,
      m.match_number,
      m.phase,
      m.match_date,
      ks.slot_home_rule,
      ks.slot_away_rule
    FROM matches m
    LEFT JOIN knockout_slots ks ON ks.match_number = m.match_number
    WHERE m.phase <> 'group_stage'
    ORDER BY m.match_number ASC
  `);

  return result.rows;
}

async function applyUpdates(pairs) {
  let updated = 0;

  for (const pair of pairs) {
    const matchResult = await pool.query(`
      UPDATE matches
      SET match_date = $1::timestamp,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND match_date IS DISTINCT FROM $1::timestamp
    `, [
      pair.event.argentinaDate,
      pair.match.id
    ]);

    const slotResult = await pool.query(`
      INSERT INTO knockout_slots (
        match_number,
        phase,
        slot_home_rule,
        slot_away_rule,
        updated_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (match_number)
      DO UPDATE SET
        phase = EXCLUDED.phase,
        slot_home_rule = EXCLUDED.slot_home_rule,
        slot_away_rule = EXCLUDED.slot_away_rule,
        updated_at = CURRENT_TIMESTAMP
      WHERE knockout_slots.slot_home_rule IS DISTINCT FROM EXCLUDED.slot_home_rule
         OR knockout_slots.slot_away_rule IS DISTINCT FROM EXCLUDED.slot_away_rule
         OR knockout_slots.phase IS DISTINCT FROM EXCLUDED.phase
    `, [
      pair.match.match_number,
      pair.match.phase,
      pair.event.homeRule,
      pair.event.awayRule
    ]);

    updated += matchResult.rowCount + slotResult.rowCount;
  }

  return updated;
}

async function main() {
  let updated = 0;

  const rawICS = await downloadCalendar(CALENDAR_URL);
  const knockoutEvents = parseEvents(rawICS);
  const knockoutMatches = await getKnockoutMatches();

  const count = Math.min(knockoutEvents.length, knockoutMatches.length);
  const pairs = [];

  for (let index = 0; index < count; index++) {
    pairs.push({
      match: knockoutMatches[index],
      event: knockoutEvents[index]
    });
  }

  console.log('\nResumen eliminatorias');
  console.log('---------------------');
  console.log(`Eventos de eliminatoria encontrados: ${knockoutEvents.length}`);
  console.log(`Partidos de eliminatoria en BD: ${knockoutMatches.length}`);
  console.log(`Pares a procesar: ${pairs.length}`);
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'PRUEBA, sin modificar BD'}`);

  console.log('\nPrimeros cruces detectados');
  console.log('--------------------------');

  for (const pair of pairs.slice(0, 12)) {
    console.log(
      `#${pair.match.match_number} | ${pair.match.phase} | ${pair.match.match_date} => ${pair.event.argentinaDate} | ${pair.event.homeRule} - ${pair.event.awayRule}`
    );
  }

  if (APPLY) {
    updated = await applyUpdates(pairs);
    console.log(`\nCambios aplicados correctamente: ${updated}`);
  } else {
    console.log('\nNo se modificó la base. Para aplicar cambios, ejecutar con --apply');
  }

  await pool.end();
}

main().catch(async error => {
  console.error('\nError:', error.message);
  await pool.end();
  process.exit(1);
});
