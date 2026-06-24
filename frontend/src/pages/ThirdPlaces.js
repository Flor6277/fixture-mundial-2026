import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ThirdPlaces() {
  const [terceros, setTerceros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThirdPlaces();
  }, []);

  const fetchThirdPlaces = async () => {
    try {
      const res = await axios.get('/api/standings/third-places');
      setTerceros(res.data.third_places || []);
    } catch {
      toast.error('Error al cargar mejores terceros');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-white">Cargando mejores terceros...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">🥉 Mejores Terceros Lugares</h2>
        <p className="text-gray-300 mt-2">Los 8 mejores terceros clasifican a los Dieciseisavos de Final.</p>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a237e] text-white text-xs uppercase">
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Equipo</th>
              <th className="px-4 py-3 text-center">Grupo</th>
              <th className="px-4 py-3 text-center">PJ</th>
              <th className="px-4 py-3 text-center">PTS</th>
              <th className="px-4 py-3 text-center">DG</th>
              <th className="px-4 py-3 text-center">GF</th>
              <th className="px-4 py-3 text-center">GC</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {terceros.length > 0 ? terceros.map((team, index) => (
              <tr key={team.country_id} className={`border-b border-white/5 transition ${team.classified ? 'bg-green-500/10' : 'bg-red-500/5'}`}>
                <td className="px-4 py-4 font-bold text-white">{index + 1}</td>
                <td className="px-4 py-4"><span className="font-medium text-white">{team.country_name}</span></td>
                <td className="px-4 py-4 text-center text-gray-300">Grupo {team.group_name}</td>
                <td className="px-4 py-4 text-center text-gray-300">{team.played}</td>
                <td className="px-4 py-4 text-center font-bold text-white">{team.points}</td>
                <td className="px-4 py-4 text-center text-gray-300">{team.goal_difference > 0 ? '+' : ''}{team.goal_difference}</td>
                <td className="px-4 py-4 text-center text-gray-300">{team.goals_for}</td>
                <td className="px-4 py-4 text-center text-gray-300">{team.goals_against}</td>
                <td className="px-4 py-4 text-center">
                  {team.classified ? (
                    <span className="flex items-center justify-center gap-1 text-green-400 font-medium"><CheckCircle size={16} />Clasificado</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1 text-red-400 font-medium"><XCircle size={16} />Eliminado</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-400">Todavía no hay terceros lugares calculados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
        <h3 className="text-white font-bold mb-2">Criterios de ordenamiento</h3>
        <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1">
          <li>Mayor cantidad de puntos.</li>
          <li>Mejor diferencia de goles.</li>
          <li>Mayor cantidad de goles a favor.</li>
          <li>Menor cantidad de goles en contra.</li>
          <li>Criterio manual si persiste la igualdad.</li>
        </ol>
      </div>
    </div>
  );
}

