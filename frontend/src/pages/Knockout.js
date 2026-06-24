import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { toast } from 'react-toastify';

const phaseLabels = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final'
};


function formatSingleSlotRule(rule) {
  let label = rule || 'Por definir';

  const simpleMatch = String(rule || '').match(/^([123])([A-L])$/);
  const thirdMatch = String(rule || '').match(/^3([A-L]+)$/);

  if (simpleMatch) {
    const position = simpleMatch[1];
    const group = simpleMatch[2];

    label = `${position}.º Grupo ${group}`;
  } else if (thirdMatch) {
    const groups = thirdMatch[1].split('').join('/');

    label = `Mejor 3.º de grupos ${groups}`;
  } else if (String(rule || '').startsWith('Winner')) {
    label = String(rule).replace('Winner', 'Ganador');
  } else if (String(rule || '').startsWith('Loser')) {
    label = String(rule).replace('Loser', 'Perdedor');
  }

  return label;
}

function formatSlotRule(rule) {
  return rule || 'Por definir';
}

function getSlotTooltip(rule) {
  let tooltip = rule || 'Por definir';
  const text = String(rule || '').trim();

  const simpleMatch = text.match(/^([123])([A-L])$/);
  const thirdMatch = text.match(/^3([A-L]+)$/);
  const winnerMatch = text.match(/^G(\d+)$/);
  const loserMatch = text.match(/^P(\d+)$/);

  if (simpleMatch) {
    const position = simpleMatch[1];
    const group = simpleMatch[2];

    tooltip = `${position}.º Grupo ${group}`;
  } else if (thirdMatch) {
    const groups = thirdMatch[1].split('').join(', ');

    tooltip = `Mejor 3.º entre los grupos ${groups}`;
  } else if (winnerMatch) {
    tooltip = `Ganador del partido ${winnerMatch[1]}`;
  } else if (loserMatch) {
    tooltip = `Perdedor del partido ${loserMatch[1]}`;
  } else if (text.includes('/')) {
    tooltip = text
      .split('/')
      .map(part => getSlotTooltip(part))
      .join(' o ');
  }

  return tooltip;
}

function SlotLabel({ value }) {
  return (
    <span
      title={getSlotTooltip(value)}
      className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-white/10 border border-white/10 cursor-help"
    >
      {formatSlotRule(value)}
    </span>
  );
}


export default function Knockout() {
  const [bracket, setBracket] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBracket(); }, []);

  const fetchBracket = async () => {
    try {
      const res = await axios.get('/api/knockout/bracket');
      setBracket(res.data.bracket || {});
    } catch {
      toast.error('Error al cargar eliminatorias');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Cargando bracket...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">⚔️ Fase Eliminatoria</h2>
        <p className="text-gray-300 mt-2">Los cruces se completan automáticamente al confirmarse los resultados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(phaseLabels).map(phase => (
          <PhaseBlock key={phase} title={phaseLabels[phase]} matches={bracket[phase] || []} />
        ))}
      </div>
    </div>
  );
}

function PhaseBlock({ title, matches }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-gradient-to-r from-[#1a237e] to-[#b71c1c] px-4 py-3">
        <h3 className="text-white font-bold">{title}</h3>
      </div>
      <div className="p-4 space-y-3">
        {matches.length > 0 ? matches.map(match => <KnockoutCard key={match.match_number} match={match} />) : <p className="text-gray-400 text-sm">Sin partidos en esta fase.</p>}
      </div>
    </div>
  );
}

function KnockoutCard({ match }) {
  const home = match.home_name || match.slot_home_rule || 'Por definir';
  const away = match.away_name || match.slot_away_rule || 'Por definir';
  const hasHomeCountry = Boolean(match.home_name);
  const hasAwayCountry = Boolean(match.away_name);
  const score = match.home_score !== null ? `${match.home_score} - ${match.away_score}` : '- : -';

  return (
    <div className="bg-[#0a1628]/70 border border-white/10 rounded-xl p-4">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Partido #{match.match_number}</span>
        <span>{match.match_status || 'scheduled'}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-white">
        <div className="text-right">
          {hasHomeCountry ? home : <SlotLabel value={home} />}
        </div>
        <div className="font-bold text-lg bg-white/10 rounded-lg px-3 py-2">{score}</div>
        <div>
          {hasAwayCountry ? away : <SlotLabel value={away} />}
        </div>
      </div>
      {match.home_penalties !== null && <p className="text-center text-yellow-400 text-xs mt-2">Penales: {match.home_penalties} - {match.away_penalties}</p>}
      {match.winner_name && <p className="text-center text-green-400 text-xs mt-2">Ganador: {match.winner_name}</p>}
    </div>
  );
}

