import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { RuntimeConfig, parseRuntimeConfig } from '../../shared/config/runtime-config';

type RuntimeConfigState = {
  config: RuntimeConfig | null;
  error: string | null;
  ready: boolean;
};

const RuntimeConfigContext = createContext<RuntimeConfigState>({
  config: null,
  error: null,
  ready: false,
});

export const RuntimeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<RuntimeConfigState>({
    config: null,
    error: null,
    ready: false,
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/runtime-config.json');
        const payload = await response.json();
        const config = parseRuntimeConfig(payload);
        setState({ config, error: null, ready: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unable to load runtime configuration';
        setState({ config: null, error: errorMessage, ready: true });
      }
    };

    void loadConfig();
  }, []);

  return (
    <RuntimeConfigContext.Provider value={state}>
      {children}
    </RuntimeConfigContext.Provider>
  );
};

export const useRuntimeConfig = () => useContext(RuntimeConfigContext);
