import { Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { PrivacyPage } from './legal/PrivacyPage';
import { TermsPage } from './legal/TermsPage';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { GuestOnly } from './session/GuestOnly';
import { RequireAuth } from './session/RequireAuth';
import { RequireTerms } from './session/RequireTerms';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<RequireTerms />}>
          {/* La estructura (menú y barra de usuario) solo envuelve las pantallas de la aplicación. */}
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cuentas" element={<AccountsPage />} />
          </Route>
        </Route>
      </Route>
      {/* Públicas: se abren desde el registro y desde la puerta de aceptación, con o sin sesión. */}
      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}