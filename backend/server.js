const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const syncWorldCupCalendar = require('./services/syncWorldCupCalendar');
const syncWorldCup26Api = require('./services/syncWorldCup26Api');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300
});

app.use('/api/', limiter);
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/standings', require('./routes/standings'));
app.use('/api/knockout', require('./routes/knockout'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/history', require('./routes/history'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timezone: 'America/Argentina/Buenos_Aires',
    autoSyncFixture: process.env.AUTO_SYNC_FIXTURE === 'true'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

function runInitialSync() {
  const autoSyncEnabled = process.env.AUTO_SYNC_FIXTURE === 'true';

  if (autoSyncEnabled) {
    console.log('Sincronización automática activada');

    setTimeout(() => {
      syncWorldCupCalendar()
        .then(summary => {
          console.log('Sincronización automática completada');
          console.log(`Eventos leídos: ${summary.eventsRead}`);
          console.log(`Fechas actualizadas: ${summary.matchesUpdated}`);
          console.log(`Resultados detectados: ${summary.resultsDetected}`);
        })
        .catch(error => {
          console.error('Falló la sincronización automática:', error.message);
        });
    }, 1000);
  } else {
    console.log('Sincronización automática desactivada');
  }
}

const PORT = process.env.PORT || 5000;


function runWorldCup26ApiSync() {
  const enabled = process.env.AUTO_SYNC_WORLD_CUP_26 === 'true';

  if (!enabled) {
    console.log('Sincronización worldcup26.ir desactivada');
    return;
  }

  const intervalMinutes = Number(process.env.WORLD_CUP_26_SYNC_INTERVAL_MINUTES || 5);

  const runSync = () => {
    syncWorldCup26Api()
      .then(summary => {
        console.log('Sincronización worldcup26.ir completada');
        console.log(`Partidos leídos: ${summary.gamesRead}`);
        console.log(`Finalizados actualizados: ${summary.finishedUpdated}`);
        console.log(`En vivo actualizados: ${summary.liveUpdated}`);
        console.log(`Confirmados omitidos: ${summary.confirmedSkipped}`);
        console.log(`No encontrados: ${summary.notFound.length}`);
      })
      .catch(error => {
        console.error('Falló la sincronización worldcup26.ir:', error.message);
      });
  };

  console.log(`Sincronización worldcup26.ir activada cada ${intervalMinutes} minutos`);

  setTimeout(runSync, 3000);
  setInterval(runSync, intervalMinutes * 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log('Zona horaria: America/Argentina/Buenos_Aires');
  runInitialSync();
  runWorldCup26ApiSync();
});
