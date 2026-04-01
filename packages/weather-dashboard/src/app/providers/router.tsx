import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../../pages/dashboard-page';
import { LoginPage } from '../../pages/login-page';
import { useAuth } from './auth-provider';
import { useRuntimeConfig } from './runtime-config-provider';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { session, ready } = useAuth();
  const { error, ready: configReady } = useRuntimeConfig();

  if (!configReady || !ready) {
    return (
      <div className="app-shell">
        <div className="page-layout">
          <section className="app-card hero">
            <h1>Preparing dashboard</h1>
            <p className="muted">Loading configuration and session state.</p>
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <div className="page-layout">
          <section className="app-card hero">
            <h1>Configuration error</h1>
            <p className="muted">{error}</p>
          </section>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
]);

export const AppRouter = () => <RouterProvider router={router} />;
