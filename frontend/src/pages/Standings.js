import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { Download } from 'lucide-react';
import { toast } from 'react-toastify';

export default function Standings() {
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStandings();
  }, []);

  const fetchStandings = async () => {
    try {
      const res = await axios.get('/api/standings/groups');
      setStandings(res.data.standings);
    } catch {
      toast.error('Error al cargar tablas');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    try {
      const res = await axios.get('/api/pdf/standings', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tablas-mundial-2026.pdf');
      document.body.appendChild(link);
      link.click();
      toast.success('PDF descargado correctamente');
    } catch {
      toast.error('Error al generar PDF');
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Cargando tablas...</div>;

  const groupNames = Object.keys(standings).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">📊 Tablas de Posiciones</h2>
        
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupNames.map(group => (
          <GroupTable key={group} groupName={group} teams={standings[group]} />
        ))}
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

function GroupTable({ groupName, teams }) {
  const liveTeam = teams.find(team => team.live_score_label);
  const hasLiveMatch = Boolean(liveTeam);
  const getStatusColor = (status, position) => {
    if (status === 'qualified_1st') return 'bg-green-500/20 border-l-4 border-green-500';
    if (status === 'qualified_2nd') return 'bg-blue-500/20 border-l-4 border-blue-500';
    if (status === 'possible_third') return 'bg-yellow-500/20 border-l-4 border-yellow-500';
    if (status === 'eliminated') return 'bg-red-500/10 border-l-4 border-red-500 opacity-60';
    return '';
  };

  const getStatusLabel = (status) => {
    if (status === 'qualified_1st') return '1° Clasificado';
    if (status === 'qualified_2nd') return '2° Clasificado';
    if (status === 'possible_third') return 'Posible 3°';
    if (status === 'eliminated') return 'Eliminado';
    return '';
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-gradient-to-r from-[#1a237e] to-[#0d47a1] px-4 py-3">
        {hasLiveMatch && (
          <div className="flex items-center gap-2 text-xs font-bold text-green-300 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            En vivo{liveTeam.live_minute !== null && liveTeam.live_minute !== undefined ? ` · ${formatLiveClock(liveTeam.live_minute, liveTeam.live_second)}` : ''}
          </div>
        )}
        <h3 className="text-lg font-bold text-white">Grupo {groupName}</h3>
      </div>
      
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs">
            <th className="px-3 py-2 text-left">Equipo</th>
            <th className="px-2 py-2 text-center">PJ</th>
            <th className="px-2 py-2 text-center">G</th>
            <th className="px-2 py-2 text-center">E</th>
            <th className="px-2 py-2 text-center">P</th>
            <th className="px-2 py-2 text-center">DG</th>
            <th className="px-2 py-2 text-center font-bold text-white">Pts</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.country_id} className={`${getStatusColor(team.status, index + 1)} transition`}>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-gray-300 font-medium">{team.position || index + 1}</span>
                  <div>
                    <span className="font-medium text-white">{team.country_name}</span>
                    {team.status !== 'pending' && (
                      <span className="block text-xs text-gray-400">{getStatusLabel(team.status)}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-3 text-center text-gray-300">{team.played}</td>
              <td className="px-2 py-3 text-center text-gray-300">{team.won}</td>
              <td className="px-2 py-3 text-center text-gray-300">{team.drawn}</td>
              <td className="px-2 py-3 text-center text-gray-300">{team.lost}</td>
              <td className="px-2 py-3 text-center text-gray-300">
                {team.live_score_label ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold">
                    {team.live_score_label}
                  </span>
                ) : (
                  team.goal_difference
                )}
              </td>
              <td className="px-2 py-3 text-center">
                <span className="text-lg font-bold text-white">{team.points}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Detalle expandido */}
      <div className="px-4 py-3 bg-white/5 text-xs text-gray-400 grid grid-cols-4 gap-2">
        <div>PG: {teams[0]?.won}</div>
        <div>PE: {teams[0]?.drawn}</div>
        <div>PP: {teams[0]?.lost}</div>
        <div>DG: {teams[0]?.goal_difference > 0 ? '+' : ''}{teams[0]?.goal_difference}</div>
      </div>
    </div>
  );
}




