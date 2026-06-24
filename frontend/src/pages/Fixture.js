import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axios';
import { Filter, Search, Pencil, CheckCircle, PlusCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import ResultModal from '../components/ResultModal';


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
  let label = rule || 'Por definir';
  const text = String(rule || '').trim();

  if (text.includes('/')) {
    const parts = text.split('/').map(part => formatSingleSlotRule(part));
    label = `Ganador de ${parts.join(' vs ')}`;
  } else {
    label = formatSingleSlotRule(text);
  }

  return label;
}


export default function Fixture() {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({ phase: '', group: '', country: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const statusFilterLabels = {
    scheduled: 'Programado',
    played: 'Jugado',
    confirmed: 'Confirmado',
    edited: 'Editado'
  };

  const phaseOptions = useMemo(() => {
    return Array.from(new Set(matches.map(match => match.phase).filter(Boolean)));
  }, [matches]);

  const groupOptions = useMemo(() => {
    return Array.from(new Set(matches.map(match => match.group_name).filter(Boolean))).sort();
  }, [matches]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(matches.map(match => match.status).filter(Boolean)));
  }, [matches]);

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    let result = [...matches];

    if (filters.phase) {
      result = result.filter(m => m.phase === filters.phase);
    }

    if (filters.group) {
      result = result.filter(m => m.group_name === filters.group);
    }

    if (filters.country) {
      const search = filters.country.toLowerCase();
      result = result.filter(m =>
        m.home_name?.toLowerCase().includes(search) ||
        m.away_name?.toLowerCase().includes(search)
      );
    }

    if (filters.status) {
      result = result.filter(m => m.status === filters.status);
    }

    result.sort((a, b) => {
      const dateA = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;

      if (dateA !== dateB) return dateA - dateB;
      return Number(a.match_number) - Number(b.match_number);
    });

    setFiltered(result);
  }, [matches, filters]);

  const pendingMatches = useMemo(() => {
    return filtered.filter(match =>
      match.status === 'scheduled' ||
      match.status === 'live'
    );
  }, [filtered]);

  const playedMatches = useMemo(() => {
    return filtered
      .filter(match =>
        match.status !== 'scheduled' &&
        match.status !== 'live'
      )
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;

        return dateB - dateA || Number(b.match_number) - Number(a.match_number);
      });
  }, [filtered]);

  const groupMatchesByDate = (matchesToGroup) => {
    const groups = {};

    for (const match of matchesToGroup) {
      const dateKey = match.match_date
        ? new Date(match.match_date).toLocaleDateString('es-AR', {
                weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })
        : 'Fecha por definir';

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(match);
    }

    return Object.entries(groups);
  };

  const pendingGroupedMatches = useMemo(() => {
    return groupMatchesByDate(pendingMatches);
  }, [pendingMatches]);

  const playedGroupedMatches = useMemo(() => {
    return groupMatchesByDate(playedMatches)
      .sort(([, matchesA], [, matchesB]) => {
        const dateA = matchesA[0]?.match_date ? new Date(matchesA[0].match_date).getTime() : 0;
        const dateB = matchesB[0]?.match_date ? new Date(matchesB[0].match_date).getTime() : 0;

        return dateB - dateA;
      });
  }, [playedMatches]);

  const fetchMatches = async () => {
    try {
      const res = await axios.get('/api/matches');
      setMatches(res.data.matches || []);
    } catch {
      toast.error('Error al cargar fixture');
    } finally {
      setLoading(false);
    }
  };

  const confirmResult = async (match) => {
    try {
      await axios.post(`/api/matches/${match.match_number}/confirm`);
      toast.success('Resultado confirmado');
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al confirmar resultado');
    }
  };

  const phases = {
    group_stage: 'Fase de Grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarterfinal: 'Cuartos',
    semifinal: 'Semifinales',
    third_place: 'Tercer Puesto',
    final: 'Final'
  };

  if (loading) {
    return <div className="text-center py-12 text-white">Cargando fixture...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">📅 Fixture completo</h2>
          <p className="text-sm text-gray-300 mt-1">Ordenado por día y horario.</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-2 mb-3 text-gray-300">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={filters.phase} onChange={e => setFilters({ ...filters, phase: e.target.value })} className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las fases</option>
            {phaseOptions.map(key => <option key={key} value={key}>{phases[key] || key}</option>)}
          </select>

          <select value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })} className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los grupos</option>
            {groupOptions.map(g => <option key={g} value={g}>Grupo {g}</option>)}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input type="text" placeholder="Buscar país..." value={filters.country} onChange={e => setFilters({ ...filters, country: e.target.value })} className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            {statusOptions.map(status => <option key={status} value={status}>{statusFilterLabels[status] || status}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-10">
        <FixtureSection
          title="Jugados"
          description="Partidos finalizados"
          groupedMatches={playedGroupedMatches}
          isAdmin={isAdmin}
          onLoadMatch={(match) => setModal({ match, mode: 'create' })}
          onEditMatch={(match) => setModal({ match, mode: 'edit' })}
          onConfirmMatch={confirmResult}
        />

        <FixtureSection
          title="Por jugar"
          description="Partidos pendientes o en curso"
          groupedMatches={pendingGroupedMatches}
          isAdmin={isAdmin}
          onLoadMatch={(match) => setModal({ match, mode: 'create' })}
          onEditMatch={(match) => setModal({ match, mode: 'edit' })}
          onConfirmMatch={confirmResult}
        />

        {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No se encontraron partidos.</p>}
      </div>

      {modal && (
        <ResultModal
          match={modal.match}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSaved={fetchMatches}
        />
      )}
    </div>
  );
}


function FixtureSection({ title, description, groupedMatches, isAdmin, onLoadMatch, onEditMatch, onConfirmMatch }) {
  const totalMatches = groupedMatches.reduce((total, [, matches]) => total + matches.length, 0);

  return (
    <section className="space-y-4">
      <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 px-4 py-3">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400">{description} · {totalMatches} partido{totalMatches !== 1 ? 's' : ''}</p>
      </div>

      {groupedMatches.length === 0 ? (
        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-6 text-center text-gray-400">
          No hay partidos en esta sección.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedMatches.map(([dateLabel, dayMatches]) => (
            <div key={dateLabel} className="space-y-3">
              <div className="sticky top-[52px] z-40 bg-[#0a1628]/95 backdrop-blur border border-white/10 rounded-xl px-4 py-3 shadow-lg">
                <h4 className="text-white font-bold capitalize">{dateLabel}</h4>
                <p className="text-xs text-gray-400">{dayMatches.length} partido{dayMatches.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="space-y-3">
                {dayMatches.map(match => (
                  <MatchCard
                    key={match.match_number}
                    match={match}
                    isAdmin={isAdmin}
                    onLoad={() => onLoadMatch(match)}
                    onEdit={() => onEditMatch(match)}
                    onConfirm={() => onConfirmMatch(match)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({ match, isAdmin, onLoad, onEdit, onConfirm }) {
  const statusColors = { scheduled: 'border-gray-600', played: 'border-yellow-500', confirmed: 'border-green-500', edited: 'border-orange-500' };
  const statusLabels = { scheduled: 'Programado', played: 'Jugado', confirmed: 'Confirmado', edited: 'Editado' };
  const phaseLabels = {
    group_stage: 'Fase de grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos de final',
    quarterfinal: 'Cuartos de final',
    semifinal: 'Semifinal',
    third_place: 'Tercer puesto',
    final: 'Final'
  };

  const phaseLabel = match.phase === 'group_stage'
    ? `Grupo ${match.group_name}`
    : phaseLabels[match.phase] || match.phase;

  const hasResult = match.home_score !== null && match.away_score !== null;

  const timeLabel = match.match_date
    ? new Date(match.match_date).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '--:--';

  return (
    <div className={`bg-white/5 backdrop-blur rounded-xl p-4 border-l-4 ${statusColors[match.status] || 'border-gray-600'} hover:bg-white/10 transition`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-yellow-300 min-w-[54px]">{timeLabel}</span>
          <span className="text-xs font-bold text-gray-400">#{match.match_number}</span>
          <span className="text-xs px-2 py-1 bg-white/10 rounded text-gray-300">{phaseLabel}</span>
          <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300">{statusLabels[match.status] || match.status}</span>
        </div>

        <div className="text-xs text-gray-400">
          {match.stadium || 'Sede por definir'} · {match.city || 'Ciudad por definir'}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 md:gap-6 mt-3">
        <div className="flex items-center gap-2 flex-1 justify-end text-right">
          <span className="text-base md:text-lg font-bold text-white">{match.home_name || formatSlotRule(match.slot_home_rule)}</span></div>

        <div className="bg-[#0a1628] px-4 md:px-6 py-3 rounded-xl border border-white/20 min-w-[96px] text-center">
          <span className="text-2xl font-bold text-white">{match.home_score !== null ? match.home_score : '-'} <span className="text-gray-500">:</span> {match.away_score !== null ? match.away_score : '-'}</span>
          {match.home_penalties !== null && <div className="text-xs text-yellow-400 mt-1">Penales: {match.home_penalties} - {match.away_penalties}</div>}
        </div>

        <div className="flex items-center gap-2 flex-1"><span className="text-base md:text-lg font-bold text-white">{match.away_name || formatSlotRule(match.slot_away_rule)}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mt-3 gap-3 text-xs text-gray-400">
        <span>{match.is_confirmed ? 'Resultado confirmado' : 'Pendiente de confirmación'}</span>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {!hasResult && <button onClick={onLoad} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><PlusCircle size={14} /> Cargar</button>}
            {hasResult && <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg"><Pencil size={14} /> Editar</button>}
            {hasResult && !match.is_confirmed && <button onClick={onConfirm} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg"><CheckCircle size={14} /> Confirmar</button>}
            {match.is_confirmed && <span className="flex items-center gap-1 text-green-400"><CheckCircle size={14} /> Confirmado</span>}
          </div>
        )}
      </div>
    </div>
  );
}




