import { RuntimeConfigProvider } from './providers/runtime-config-provider';
import { AuthProvider } from './providers/auth-provider';
import { AppRouter } from './providers/router';

export const App = () => (
  <RuntimeConfigProvider>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </RuntimeConfigProvider>
);
