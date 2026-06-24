import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Fixture from './pages/Fixture';
import Standings from './pages/Standings';
import ThirdPlaces from './pages/ThirdPlaces';
import Knockout from './pages/Knockout';
import History from './pages/History';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

function ProtectedLayout({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/fixture" element={<ProtectedLayout><Fixture /></ProtectedLayout>} />
          <Route path="/standings" element={<ProtectedLayout><Standings /></ProtectedLayout>} />
          <Route path="/third-places" element={<ProtectedLayout><ThirdPlaces /></ProtectedLayout>} />
          <Route path="/knockout" element={<ProtectedLayout><Knockout /></ProtectedLayout>} />
          <Route path="/history" element={<ProtectedLayout adminOnly><History /></ProtectedLayout>} />
          <Route path="/admin" element={<ProtectedLayout adminOnly><Admin /></ProtectedLayout>} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

