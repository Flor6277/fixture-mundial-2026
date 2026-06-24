import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { toast } from 'react-toastify';

export default function History() {
  const [data, setData] = useState({ results: [], edits: [] });
  const [tab, setTab] = useState('results');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/history');
      setData(res.data || { results: [], edits: [] });
    } catch {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Cargando historial...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">🕘 Historial</h2>

      <div className="flex gap-2">
        <button onClick={() => setTab('results')} className={`px-4 py-2 rounded-lg ${tab === 'results' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300'}`}>Resultados</button>
        <button onClick={() => setTab('edits')} className={`px-4 py-2 rounded-lg ${tab === 'edits' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300'}`}>Ediciones</button>
      </div>

      {tab === 'results' ? <ResultsTable rows={data.results} /> : <EditsTable rows={data.edits} />}
    </div>
  );
}

function ResultsTable({ rows }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#1a237e] text-white text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Partido</th>
            <th className="px-4 py-3 text-left">Encuentro</th>
            <th className="px-4 py-3 text-center">Resultado</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-left">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map(row => (
            <tr key={row.match_number} className="border-b border-white/5 text-gray-300">
              <td className="px-4 py-3 text-white font-bold">#{row.match_number}</td>
              <td className="px-4 py-3">{row.home_name} vs {row.away_name}</td>
              <td className="px-4 py-3 text-center text-white font-bold">{row.home_score} - {row.away_score}</td>
              <td className="px-4 py-3 text-center">{row.is_confirmed ? 'Confirmado' : row.status}</td>
              <td className="px-4 py-3">{row.updated_at ? new Date(row.updated_at).toLocaleString('es-AR') : '-'}</td>
            </tr>
          )) : <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400">Aún no hay resultados cargados.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function EditsTable({ rows }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#b71c1c] text-white text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Partido</th>
            <th className="px-4 py-3 text-left">Encuentro</th>
            <th className="px-4 py-3 text-center">Anterior</th>
            <th className="px-4 py-3 text-center">Nuevo</th>
            <th className="px-4 py-3 text-left">Motivo</th>
            <th className="px-4 py-3 text-left">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map(row => (
            <tr key={row.id} className="border-b border-white/5 text-gray-300">
              <td className="px-4 py-3 text-white font-bold">#{row.match_number}</td>
              <td className="px-4 py-3">{row.home_name} vs {row.away_name}</td>
              <td className="px-4 py-3 text-center">{row.previous_home_score ?? '-'} - {row.previous_away_score ?? '-'}</td>
              <td className="px-4 py-3 text-center text-white font-bold">{row.new_home_score} - {row.new_away_score}</td>
              <td className="px-4 py-3">{row.reason || '-'}</td>
              <td className="px-4 py-3">{row.edited_by_name}</td>
            </tr>
          )) : <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No hay ediciones registradas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

