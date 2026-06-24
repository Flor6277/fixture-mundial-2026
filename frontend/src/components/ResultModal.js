import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ResultModal({ match, mode = 'create', onClose, onSaved }) {
  const [form, setForm] = useState({
    home_score: '',
    away_score: '',
    home_penalties: '',
    away_penalties: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match) {
      setForm({
        home_score: match.home_score ?? '',
        away_score: match.away_score ?? '',
        home_penalties: match.home_penalties ?? '',
        away_penalties: match.away_penalties ?? '',
        reason: ''
      });
    }
  }, [match]);

  if (!match) return null;

  const isEdit = mode === 'edit';
  const isKnockout = match.phase !== 'group_stage';

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const payload = () => ({
    home_score: Number(form.home_score),
    away_score: Number(form.away_score),
    home_penalties: form.home_penalties === '' ? null : Number(form.home_penalties),
    away_penalties: form.away_penalties === '' ? null : Number(form.away_penalties),
    reason: form.reason
  });

  const save = async (e) => {
    e.preventDefault();

    if (form.home_score === '' || form.away_score === '') {
      toast.error('Cargá los goles de ambos equipos');
      return;
    }

    if (isEdit && form.reason.trim().length < 5) {
      toast.error('Para editar, indicá un motivo de al menos 5 caracteres');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await axios.put(`/api/matches/${match.match_number}/result`, payload());
      } else {
        await axios.post(`/api/matches/${match.match_number}/result`, payload());
      }
      toast.success(isEdit ? 'Resultado editado' : 'Resultado cargado');
      onSaved?.();
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al guardar resultado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold">{isEdit ? 'Editar resultado' : 'Cargar resultado'}</h3>
            <p className="text-xs text-gray-400">Partido #{match.match_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <ScoreInput
              label={match.home_name || match.slot_home_rule || 'Local'}
              value={form.home_score}
              onChange={v => handleChange('home_score', v)}
            />
            <span className="pb-3 text-gray-500 font-bold">vs</span>
            <ScoreInput
              label={match.away_name || match.slot_away_rule || 'Visitante'}
              value={form.away_score}
              onChange={v => handleChange('away_score', v)}
            />
          </div>

          {isKnockout && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-gray-300 mb-3">
                Si el partido termina empatado, cargá penales para definir ganador.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput label="Penales local" value={form.home_penalties} onChange={v => handleChange('home_penalties', v)} />
                <ScoreInput label="Penales visitante" value={form.away_penalties} onChange={v => handleChange('away_penalties', v)} />
              </div>
            </div>
          )}

          {isEdit && (
            <div>
              <label className="block text-sm text-gray-300 mb-2">Motivo de edición</label>
              <textarea
                value={form.reason}
                onChange={e => handleChange('reason', e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Ejemplo: Resultado cargado mal por error"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg">
              Cancelar
            </button>
            <button disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScoreInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-300 mb-2 min-h-[32px]">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-3 text-center text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}
