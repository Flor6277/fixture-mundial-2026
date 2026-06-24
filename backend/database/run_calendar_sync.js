require('dotenv').config();

const pool = require('../database');
const syncWorldCupCalendar = require('../services/syncWorldCupCalendar');

async function main() {
  let exitCode = 0;

  try {
    const summary = await syncWorldCupCalendar();

    console.log('\nResumen manual');
    console.log('--------------');
    console.log(`Eventos leídos: ${summary.eventsRead}`);
    console.log(`Fechas actualizadas: ${summary.matchesUpdated}`);
    console.log(`Resultados detectados: ${summary.resultsDetected}`);
    console.log(`Eventos no reconocidos: ${summary.unresolvedEvents.length}`);
    console.log(`Partidos no encontrados: ${summary.notFoundEvents.length}`);
  } catch (error) {
    exitCode = 1;
    console.error('\nFalló la sincronización manual:', error.message);
  } finally {
    await pool.end();
    process.exit(exitCode);
  }
}

main();
