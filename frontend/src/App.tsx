import { Route, Routes } from 'react-router';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LegalStubPage } from './pages/LegalStubPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { GuestOnly } from './session/GuestOnly';
import { RequireAuth } from './session/RequireAuth';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/cuentas" element={<AccountsPage />} />
      </Route>
      {/* Públicas: se abren desde el registro, con o sin sesión. */}
      <Route path="/terminos" element={<LegalStubPage title="Términos de uso" />} />
      <Route path="/privacidad" element={<LegalStubPage title="Política de privacidad" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}