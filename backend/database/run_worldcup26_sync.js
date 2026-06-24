require('dotenv').config();

const syncWorldCup26Api = require('../services/syncWorldCup26Api');

syncWorldCup26Api()
  .then(summary => {
    console.log('Sincronización worldcup26.ir finalizada');
    console.log('---------------------------------------');
    console.log(`Partidos leídos: ${summary.gamesRead}`);
    console.log(`Partidos de grupos leídos: ${summary.groupGamesRead}`);
    console.log(`Finalizados actualizados: ${summary.finishedUpdated}`);
    console.log(`En vivo actualizados: ${summary.liveUpdated}`);
    console.log(`Confirmados omitidos: ${summary.confirmedSkipped}`);
    console.log(`No encontrados: ${summary.notFound.length}`);

    if (summary.notFound.length > 0) {
      console.log('Primeros no encontrados:');
      console.log(JSON.stringify(summary.notFound.slice(0, 10), null, 2));
    }

    process.exit(0);
  })
  .catch(error => {
    console.error('Error al sincronizar worldcup26.ir:');
    console.error(error.message);
    process.exit(1);
  });
