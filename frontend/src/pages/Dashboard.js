import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import { Calendar, CheckCircle, Clock, Trophy, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const PLAYED_STATUSES = ['played', 'confirmed', 'edited'];

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const matchesRes = await axios.get('/api/matches');
      const matches = matchesRes.data.matches || [];

      const liveMatches = matches
        .filter(isLiveMatch)
        .sort(sortByDateAsc);

      const upcomingMatches = matches
        .filter(isUpcomingMatch)
        .sort(sortByDateAsc);

      const recentResults = matches
        .filter(isFinishedMatch)
        .sort(sortByDateDesc)
        .slice(0, 5);

      const featuredMatches = getFeaturedMatches(liveMatches, upcomingMatches);

      const stats = {
        total_matches: matches.length,
        played_matches: matches.filter(isFinishedMatch).length,
        pending_matches: matches.filter(isUpcomingMatch).length
      };

      if (isAdmin) {
        const res = await axios.get('/api/admin/dashboard');

        setData({
          ...res.data,
          stats,
          featured_matches: featuredMatches,
          upcoming_matches: upcomingMatches.slice(0, 5),
          recent_results: recentResults
        });
      } else {
        setData({
          stats,
          featured_matches: featuredMatches,
          upcoming_matches: upcomingMatches.slice(0, 5),
          recent_results: recentResults
        });
      }
    } catch {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Cargando...</div>;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">🏆 Copa Mundial FIFA 2026</h2>
        <p className="text-blue-200">Canadá · México · Estados Unidos · Fixture interactivo</p>
      </div>

      <FeaturedMatchesSection matches={data?.featured_matches || []} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Calendar className="text-blue-400" />}
          label="Total Partidos"
          value={data?.stats?.total_matches || 0}
          color="from-blue-600/20 to-blue-800/20"
        />
        <StatCard
          icon={<CheckCircle className="text-green-400" />}
          label="Jugados"
          value={data?.stats?.played_matches || 0}
          color="from-green-600/20 to-green-800/20"
        />
        <StatCard
          icon={<Clock className="text-yellow-400" />}
          label="Pendientes"
          value={data?.stats?.pending_matches || 0}
          color="from-yellow-600/20 to-yellow-800/20"
        />
      </div>

      <Panel title="Próximos Partidos" icon={<Calendar size={20} className="text-blue-400" />}>
        {data?.upcoming_matches?.length > 0
          ? data.upcoming_matches.map(match => <MatchPreview key={match.match_number} match={match} />)
          : <p className="text-gray-400 text-center py-4">No hay partidos programados próximamente</p>
        }
      </Panel>

      <Panel title="Últimos Resultados" icon={<TrendingUp size={20} className="text-green-400" />}>
        {data?.recent_results?.length > 0
          ? data.recent_results.map(match => <ResultPreview key={match.match_number} match={match} />)
          : <p className="text-gray-400 text-center py-4">Aún no hay resultados cargados</p>
        }
      </Panel>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink to="/fixture" icon={<Calendar />} label="Ver Fixture" color="bg-blue-600" />
        <QuickLink to="/standings" icon={<Trophy />} label="Tablas" color="bg-green-600" />
        <QuickLink to="/knockout" icon={<TrendingUp />} label="Eliminatoria" color="bg-purple-600" />
        <QuickLink to="/history" icon={<Clock />} label="Historial" color="bg-orange-600" />
      </div>
    </div>
  );
}

function getFeaturedMatches(liveMatches, upcomingMatches) {
  let featuredMatches = [];

  if (liveMatches.length >= 2) {
    featuredMatches = liveMatches.slice(0, 2);
  } else if (liveMatches.length === 1) {
    featuredMatches = [liveMatches[0], upcomingMatches[0]].filter(Boolean);
  } else {
    featuredMatches = upcomingMatches.slice(0, 2);
  }

  return featuredMatches;
}

function isLiveMatch(match) {
  const liveStatuses = ['live', 'halftime', 'half_time'];

  return liveStatuses.includes(match.live_status) || match.status === 'live';
}

function isFinishedMatch(match) {
  return PLAYED_STATUSES.includes(match.status) || match.live_status === 'finished';
}

function isUpcomingMatch(match) {
  return match.status === 'scheduled' && !isLiveMatch(match);
}

function sortByDateAsc(a, b) {
  return getDateValue(a) - getDateValue(b);
}

function sortByDateDesc(a, b) {
  return getDateValue(b) - getDateValue(a);
}

function getDateValue(match) {
  return match.match_date ? new Date(match.match_date).getTime() : 0;
}

function getDashboardPhaseLabel(phase) {
  const labels = {
    group_stage: 'Fase de grupos',
    round_of_32: 'Dieciseisavos',
    round_of_16: 'Octavos',
    quarterfinal: 'Cuartos de final',
    semifinal: 'Semifinal',
    third_place: 'Tercer puesto',
    final: 'Final'
  };

  return labels[phase] || phase;
}

function getLiveTimeLabel(match) {
  let label = 'En vivo';

  if (match.live_status === 'halftime' || match.live_status === 'half_time') {
    label = 'Entretiempo';
  } else if (match.live_minute !== null && match.live_minute !== undefined) {
    label = `${match.live_minute}'`;
  }

  return label;
}

function getMatchStartLabel(match) {
  let label = 'Inicio pendiente';

  if (match.match_date) {
    label = new Date(match.match_date).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  return label;
}

function FeaturedMatchesSection({ matches }) {
  return (
    <section className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Partidos destacados</h3>
          <p className="text-xs text-gray-400">En vivo y próximos partidos</p>
        </div>

        <Link to="/fixture" className="text-xs text-blue-300 hover:text-blue-200 font-semibold">
          Ver fixture
        </Link>
      </div>

      {matches.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {matches.map(match => (
            <FeaturedMatchCard key={match.match_number} match={match} />
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-4">No hay partidos destacados</p>
      )}
    </section>
  );
}

function FeaturedMatchCard({ match }) {
  const phaseLabel = getDashboardPhaseLabel(match.phase);
  const isLive = isLiveMatch(match);
  const isFinished = isFinishedMatch(match);
  const isUpcoming = isUpcomingMatch(match);

  const homeScore = isLive ? match.live_home_score ?? match.home_score : match.home_score;
  const awayScore = isLive ? match.live_away_score ?? match.away_score : match.away_score;

  let statusLabel = 'Partido';
  let centerLabel = '';

  if (isLive) {
    statusLabel = 'En vivo';
    centerLabel = getLiveTimeLabel(match);
  } else if (isFinished) {
    statusLabel = 'Finalizado';
    centerLabel = 'Finalizado';
  } else if (isUpcoming) {
    statusLabel = 'Próximo';
    centerLabel = getMatchStartLabel(match);
  }

  const cardClass = isLive
    ? 'border-green-400/60 bg-green-500/10'
    : isUpcoming
      ? 'border-orange-400/60 bg-orange-500/10'
      : 'border-white/10 bg-white/5';

  const badgeClass = isLive
    ? 'bg-green-500/20 text-green-200 border-green-400/40'
    : isUpcoming
      ? 'bg-orange-500/20 text-orange-200 border-orange-400/40'
      : 'bg-gray-500/20 text-gray-200 border-gray-400/40';

  return (
    <article className={`rounded-xl border p-4 ${cardClass}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">
            #{match.match_number} · {phaseLabel}{match.group_name ? ` · Grupo ${match.group_name}` : ''}
          </p>
        </div>

        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${badgeClass}`}>
          {isLive && <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse mr-1"></span>}
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <TeamName name={match.home_name || match.slot_home_rule || 'Por definir'} />

        <div className="min-w-[82px] sm:min-w-[96px] text-center">
          {isLive || isFinished ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-white">{homeScore ?? '-'}</span>
                <span className="text-gray-400 font-bold">-</span>
                <span className="text-2xl sm:text-3xl font-bold text-white">{awayScore ?? '-'}</span>
              </div>

              <span className={`text-xs font-bold ${isLive ? 'text-green-200' : 'text-gray-300'}`}>
                {centerLabel}
              </span>
            </div>
          ) : (
            <div className="px-2 py-2 rounded-lg bg-white/10 text-orange-100 font-bold text-xs sm:text-sm leading-tight">
              {centerLabel}
            </div>
          )}
        </div>

        <TeamName name={match.away_name || match.slot_away_rule || 'Por definir'} />
      </div>
    </article>
  );
}

function TeamName({ name }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-sm sm:text-base md:text-lg font-bold text-white leading-tight break-words">
        {name}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} backdrop-blur rounded-xl p-4 border border-white/10`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-sm text-gray-300">{label}</p>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function MatchPreview({ match }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition gap-2">
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <span className="text-xs text-gray-400">#{match.match_number}</span>
        <span className="text-sm text-white break-words">{match.home_name || match.slot_home_rule}</span>
        <span className="text-gray-500">vs</span>
        <span className="text-sm text-white break-words">{match.away_name || match.slot_away_rule}</span>
      </div>

      <div className="text-xs text-gray-400 shrink-0">
        {match.match_date
          ? new Date(match.match_date).toLocaleString('es-AR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          : 'Sin fecha'
        }
      </div>
    </div>
  );
}

function ResultPreview({ match }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-white/5 rounded-lg gap-2">
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <span className="text-xs text-gray-400">#{match.match_number}</span>
        <span className="text-sm text-white break-words">{match.home_name}</span>
        <span className="font-bold text-blue-400 shrink-0">{match.home_score} - {match.away_score}</span>
        <span className="text-sm text-white break-words">{match.away_name}</span>
      </div>

      <span className="text-xs text-gray-400">
        {match.updated_by || match.confirmed_by_name || 'Sistema'}
      </span>
    </div>
  );
}

function QuickLink({ to, icon, label, color }) {
  return (
    <Link
      to={to}
      className={`${color} hover:opacity-90 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition transform hover:scale-[1.02]`}
    >
      {React.cloneElement(icon, { size: 24 })}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}



