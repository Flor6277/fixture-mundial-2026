const PDFDocument = require('pdfkit');

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function exportarPDF(html) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 42, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const text = stripHtml(html);
      doc.fontSize(18).text('Fixture Mundial FIFA 2026', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#555').text(`Generado: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#000').fontSize(10).text(text, { align: 'left', lineGap: 3 });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function phaseLabel(phase) {
  const labels = {
    group_stage: 'Fase de grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarterfinal: 'Cuartos',
    semifinal: 'Semifinal',
    third_place: 'Tercer puesto',
    final: 'Final'
  };
  return labels[phase] || phase;
}

function generarHTMLFixture(matches, title, generatedAt) {
  const rows = matches.map(m => {
    const home = m.home_name || m.slot_home_rule || 'Por definir';
    const away = m.away_name || m.slot_away_rule || 'Por definir';
    const score = m.home_score !== null && m.away_score !== null ? `${m.home_score} - ${m.away_score}` : 'Pendiente';
    const date = m.match_date ? new Date(m.match_date).toLocaleString('es-AR') : 'Sin fecha';
    return `<tr><td>${m.match_number}</td><td>${phaseLabel(m.phase)}</td><td>${date}</td><td>${home}</td><td>${score}</td><td>${away}</td><td>${m.city || ''}</td><td>${m.status || ''}</td></tr>`;
  }).join('');

  return `
    <html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#111} h1{text-align:center;color:#1a237e} p{text-align:center;color:#555}
      table{width:100%;border-collapse:collapse;font-size:11px} th{background:#1a237e;color:#fff} td,th{border:1px solid #ddd;padding:6px;text-align:left}
    </style></head><body>
    <h1>${title}</h1><p>Generado: ${generatedAt}</p>
    <table><thead><tr><th>#</th><th>Fase</th><th>Fecha</th><th>Local</th><th>Resultado</th><th>Visitante</th><th>Ciudad</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
}

function generarHTMLTablas(standings, title, generatedAt) {
  const blocks = Object.entries(standings).map(([group, rows]) => {
    const body = rows.map(t => `<tr><td>${t.position}</td><td>${t.flag_emoji || ''} ${t.country_name}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.goals_for}</td><td>${t.goals_against}</td><td>${t.goal_difference}</td><td>${t.points}</td></tr>`).join('');
    return `<h2>Grupo ${group}</h2><table><thead><tr><th>Pos</th><th>País</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>${body}</tbody></table>`;
  }).join('');

  return `
    <html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#111} h1{text-align:center;color:#1a237e} h2{color:#b71c1c} p{text-align:center;color:#555}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px} th{background:#1a237e;color:#fff} td,th{border:1px solid #ddd;padding:6px;text-align:left}
    </style></head><body>
    <h1>${title}</h1><p>Generado: ${generatedAt}</p>${blocks}</body></html>`;
}

module.exports = { exportarPDF, generarHTMLFixture, generarHTMLTablas };
