import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import { Calendar, CheckCircle, Clock, AlertCircle, Trophy, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const featuredRes = await axios.get('/api/matches/featured');
      const featuredMatch = featuredRes.data.match || null;

      if (isAdmin) {
        const res = await axios.get('/api/admin/dashboard');
        setData({ ...res.data, featured_match: featuredMatch });
      } else {
        const res = await axios.get('/api/matches');
        const matches = res.data.matches || [];
        setData({
          featured_match: featuredMatch,
          stats: {
            total_matches: matches.length,
            played_matches: matches.filter(m => ['played', 'confirmed', 'edited'].includes(m.status)).length,
            pending_matches: matches.filter(m => m.status === 'scheduled').length,
            unconfirmed_matches: matches.filter(m => m.status === 'played' && !m.is_confirmed).length
          },
          upcoming_matches: matches.filter(m => m.status === 'scheduled').slice(0, 5),
          recent_results: matches.filter(m => ['played', 'confirmed', 'edited'].includes(m.status)).slice(-5).reverse()
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
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">🏆 Copa Mundial FIFA 2026</h2>
        <p className="text-blue-200">Canadá · México · Estados Unidos · Fixture privado</p>
      </div>

      {data?.featured_match && (
        <div className="max-w-xl mx-auto">
          <FeaturedMatchCard match={data.featured_match} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Calendar className="text-blue-400" />} label="Total Partidos" value={data?.stats?.total_matches || 0} color="from-blue-600/20 to-blue-800/20" />
        <StatCard icon={<CheckCircle className="text-green-400" />} label="Jugados" value={data?.stats?.played_matches || 0} color="from-green-600/20 to-green-800/20" />
        <StatCard icon={<Clock className="text-yellow-400" />} label="Pendientes" value={data?.stats?.pending_matches || 0} color="from-yellow-600/20 to-yellow-800/20" />
        <StatCard icon={<AlertCircle className="text-red-400" />} label="Sin Confirmar" value={data?.stats?.unconfirmed_matches || 0} color="from-red-600/20 to-red-800/20" />
      </div>

      <Panel title="Próximos Partidos" icon={<Calendar size={20} className="text-blue-400" />}>
        {data?.upcoming_matches?.length > 0 ? data.upcoming_matches.map(match => <MatchPreview key={match.match_number} match={match} />) : <p className="text-gray-400 text-center py-4">No hay partidos programados próximamente</p>}
      </Panel>

      <Panel title="Últimos Resultados" icon={<TrendingUp size={20} className="text-green-400" />}>
        {data?.recent_results?.length > 0 ? data.recent_results.map(match => <ResultPreview key={match.match_number} match={match} />) : <p className="text-gray-400 text-center py-4">Aún no hay resultados cargados</p>}
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


function formatLiveClock(minute, second) {
  let label = 'En vivo';

  if (minute !== null && minute !== undefined) {
    const safeSecond = String(second || 0).padStart(2, '0');
    label = `${minute}:${safeSecond}`;
  }

  return label;
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

function FeaturedMatchCard({ match }) {
  const phaseLabel = getDashboardPhaseLabel(match.phase);
  const isLive = match.feature_status === 'live';
  const isFinished = match.feature_status === 'finished';
  const isUpcoming = match.feature_status === 'upcoming';
  const isEstimatedLive = isLive && match.estimated_live;

  const homeScore = isLive ? match.live_home_score : match.home_score;
  const awayScore = isLive ? match.live_away_score : match.away_score;

  const startTime = match.match_date
    ? new Date(match.match_date).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '';

  let statusLabel = 'Partido';
  let centerLabel = '';

  if (isLive) {
    statusLabel = 'En vivo';
    centerLabel = isEstimatedLive ? `En curso · ${match.live_minute}' aprox.` : formatLiveClock(match.live_minute, match.live_second);
  } else if (isFinished) {
    statusLabel = 'Finalizado';
    centerLabel = 'Finalizado';
  } else if (isUpcoming) {
    statusLabel = 'Próximo partido';
    centerLabel = startTime ? `Inicio · ${startTime}` : 'Inicio pendiente';
  }

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div>
          <h3 className="text-white font-bold">Partidos</h3>
          <p className={`text-xs font-bold flex items-center gap-2 mt-1 ${isLive ? 'text-green-300' : isFinished ? 'text-gray-300' : 'text-blue-300'}`}>
            {isLive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>}
            {statusLabel}
          </p>
        </div>
      </div>

      <div className="px-3 py-3">
        <p className="text-sm text-gray-400 mb-4">
          Copa Mundial FIFA 2026 · {phaseLabel}{match.group_name ? ' · Grupo ' + match.group_name : ''}
        </p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-center">
            <div className="text-base md:text-lg font-bold text-white">{match.home_name}</div>
          </div>

          <div className="text-center min-w-[120px]">
            {((isLive && !isEstimatedLive) || isFinished) ? (
              <div className="flex items-center justify-center gap-6">
                <span className="text-3xl font-bold text-white">{homeScore ?? '-'}</span>
                <span className={`font-bold text-lg ${isLive ? 'text-green-300' : 'text-gray-300'}`}>
                  {centerLabel}
                </span>
                <span className="text-3xl font-bold text-white">{awayScore ?? '-'}</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-white/10 text-blue-200 font-bold">
                {centerLabel}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-base md:text-lg font-bold text-white">{match.away_name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return <div className={`bg-gradient-to-br ${color} backdrop-blur rounded-xl p-4 border border-white/10`}><div className="flex items-center justify-between mb-2">{icon}<span className="text-2xl font-bold text-white">{value}</span></div><p className="text-sm text-gray-300">{label}</p></div>;
}

function Panel({ title, icon, children }) {
  return <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">{icon}{title}</h3><div className="space-y-3">{children}</div></div>;
}

function MatchPreview({ match }) {
  return <div className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition gap-2"><div className="flex items-center gap-3 flex-wrap"><span className="text-xs text-gray-400">#{match.match_number}</span><span className="text-sm text-white">{match.home_name || match.slot_home_rule}</span><span className="text-gray-500">vs</span><span className="text-sm text-white">{match.away_name || match.slot_away_rule}</span></div><div className="text-xs text-gray-400">{match.match_date ? new Date(match.match_date).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit',
        minute: '2-digit',
        hour12: false }) : 'Sin fecha'}</div></div>;
}

function ResultPreview({ match }) {
  return <div className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-white/5 rounded-lg gap-2"><div className="flex items-center gap-3 flex-wrap"><span className="text-xs text-gray-400">#{match.match_number}</span><span className="text-sm text-white">{match.home_name}</span><span className="font-bold text-blue-400">{match.home_score} - {match.away_score}</span><span className="text-sm text-white">{match.away_name}</span></div><span className="text-xs text-gray-400">{match.updated_by || match.confirmed_by_name || 'Sistema'}</span></div>;
}

function QuickLink({ to, icon, label, color }) {
  return <Link to={to} className={`${color} hover:opacity-90 text-white rounded-xl p-4 flex flex-col items-center gap-2 transition transform hover:scale-[1.02]`}>{React.cloneElement(icon, { size: 24 })}<span className="text-sm font-medium">{label}</span></Link>;
}





