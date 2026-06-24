import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { toast } from 'react-toastify';
import { Shield, Users, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get('/api/admin/dashboard');
      setData(res.data);
    } catch {
      toast.error('Error al cargar panel admin');
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await axios.put(`/api/admin/users/${userId}/role`, { role });
      toast.success('Rol actualizado');
      fetchDashboard();
    } catch {
      toast.error('Error al actualizar rol');
    }
  };


  const deleteUser = async (userId, userName) => {
    const confirmed = window.confirm(`¿Seguro que querés eliminar/desactivar a ${userName}?`);

    if (confirmed) {
      try {
        await axios.delete(`/api/admin/users/${userId}`);
        toast.success('Usuario eliminado correctamente');
        fetchDashboard();
      } catch (error) {
        const message = error.response?.data?.error || 'No se pudo eliminar usuario';
        toast.error(message);
      }
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Cargando panel...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">Panel Administrador</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStat label="Total" value={data?.stats?.total_matches} icon={<Calendar />} />
        <AdminStat label="Jugados" value={data?.stats?.played_matches} icon={<Calendar />} />
        <AdminStat label="Pendientes" value={data?.stats?.pending_matches} icon={<Calendar />} />
        <AdminStat label="Usuarios" value={data?.users?.length || 0} icon={<Users />} />
      </div>

      <section className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-[#1a237e] text-white font-bold flex items-center gap-2"><Users size={18} /> Usuarios</div>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-center">Rol</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data?.users?.map(user => (
              <tr key={user.id} className="border-t border-white/5 text-gray-300">
                <td className="px-4 py-3 text-white">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 text-center">{user.role}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={currentUser?.id === user.id}
                      onClick={() => changeRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                      className={`px-3 py-1.5 rounded-lg text-white ${currentUser?.id === user.id ? 'bg-gray-600 opacity-60 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {currentUser?.id === user.id ? 'Tu usuario' : `Hacer ${user.role === 'admin' ? 'usuario' : 'admin'}`}
                    </button>

                    <button
                      disabled={currentUser?.id === user.id}
                      onClick={() => deleteUser(user.id, user.name || user.email)}
                      className={`px-3 py-1.5 rounded-lg text-white ${currentUser?.id === user.id ? 'bg-gray-600 opacity-60 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
        <h3 className="text-white font-bold mb-3">Cambios recientes</h3>
        <div className="space-y-2">
          {data?.recent_history?.length > 0 ? data.recent_history.map(item => (
            <div key={item.id} className="bg-white/5 rounded-lg p-3 text-sm text-gray-300">
              Partido #{item.match_number}: {item.previous_home_score ?? '-'} - {item.previous_away_score ?? '-'} → <span className="text-white font-bold">{item.new_home_score} - {item.new_away_score}</span>. Motivo: {item.reason || '-'}
            </div>
          )) : <p className="text-gray-400">Sin ediciones recientes.</p>}
        </div>
      </section>
    </div>
  );
}

function AdminStat({ label, value, icon }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white">
      <div className="flex justify-between items-center mb-2 text-blue-300">{icon}<span className="text-2xl font-bold text-white">{value ?? 0}</span></div>
      <p className="text-sm text-gray-300">{label}</p>
    </div>
  );
}
