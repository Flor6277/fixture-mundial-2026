import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Trophy,
  LogOut,
  User,
  Shield,
  Table,
  Calendar,
  Swords,
  FileText,
  History,
} from "lucide-react";

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: <Trophy size={20} />, label: "Inicio" },
    { path: "/fixture", icon: <Calendar size={20} />, label: "Fixture" },
    { path: "/standings", icon: <Table size={20} />, label: "Tablas" },
    {
      path: "/third-places",
      icon: <Table size={20} />,
      label: "Mejores Terceros",
    },
    { path: "/knockout", icon: <Swords size={20} />, label: "Eliminatoria" },
    ...(isAdmin
      ? [{ path: "/history", icon: <History size={20} />, label: "Historial" }]
      : []),
    ...(isAdmin
      ? [{ path: "/admin", icon: <Shield size={20} />, label: "Admin" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a237e] to-[#0d47a1]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#0d47a1] to-[#b71c1c] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={32} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Fixture Mundial FIFA 2026
              </h1>
              <p className="text-xs text-blue-200">
                Canadá · México · Estados Unidos
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="flex items-center gap-2 text-sm">
                  <User size={16} />
                  {user.name}
                  {isAdmin && <Shield size={14} className="text-yellow-400" />}
                </span>
                <button
                  onClick={logout}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition text-sm font-medium"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      {user && (
        <nav className="bg-[#0a1628]/80 backdrop-blur border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    location.pathname === item.path
                      ? "bg-white/10 text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="bg-[#0a1628] border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-400 text-sm">
          <p className="font-semibold text-white">Fixture Mundial FIFA 2026</p>

          <p className="mt-1">Horarios mostrados según tu zona horaria local</p>

          <p className="mt-1">
            Desarrollado por{" "}
            <a
              href="https://www.instagram.com/flormolina99/"
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-gray-300 no-underline cursor-pointer"
            >
              Flor Molina ♥
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
