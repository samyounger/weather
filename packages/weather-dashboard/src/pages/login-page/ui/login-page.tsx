import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import { AuthForm } from '../../../features/auth-form';

export const LoginPage = () => {
  const { config } = useRuntimeConfig();

  return (
    <main className="app-shell">
      <div className="auth-layout">
        <section className="app-card hero">
          <h1>Weather Dashboard</h1>
          <p className="muted">
            {config?.mockMode
              ? 'Local mock mode is enabled. Use any email and password to enter the dashboard and load sample data.'
              : 'Sign in with your private Cognito user to access the authenticated weather API.'}
          </p>
        </section>
        <section className="app-card hero">
          <AuthForm />
        </section>
      </div>
    </main>
  );
};
