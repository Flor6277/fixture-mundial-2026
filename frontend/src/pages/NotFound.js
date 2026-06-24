import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#1a237e] to-[#0d47a1] p-4">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center text-white max-w-md">
        <Trophy className="mx-auto text-yellow-400 mb-4" size={48} />
        <h1 className="text-3xl font-bold mb-2">Página no encontrada</h1>
        <p className="text-gray-300 mb-6">Ese cruce no existe en el fixture.</p>
        <Link to="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
