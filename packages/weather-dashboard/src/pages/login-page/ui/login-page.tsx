import { AuthForm } from '../../../features/auth-form';

export const LoginPage = () => (
  <main className="app-shell">
    <div className="auth-layout">
      <section className="app-card hero">
        <h1>Weather Dashboard</h1>
        <p className="muted">
          Sign in with your private Cognito user to access the authenticated weather API.
        </p>
      </section>
      <section className="app-card hero">
        <AuthForm />
      </section>
    </div>
  </main>
);
