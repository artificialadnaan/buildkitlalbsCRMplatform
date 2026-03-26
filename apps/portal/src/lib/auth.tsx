import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { portalApi } from './api.js';

interface PortalUser {
  portalUserId: string;
  companyId: string;
  email: string;
}

interface PortalProject {
  id: string;
  name: string;
  type: string;
  status: string;
  progressPercent: number;
}

interface PortalAuthContextValue {
  authenticated: boolean;
  loading: boolean;
  projects: PortalProject[];
  activeProject: PortalProject | null;
  setActiveProject: (project: PortalProject) => void;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextValue>({
  authenticated: false,
  loading: true,
  projects: [],
  activeProject: null,
  setActiveProject: () => {},
  logout: () => {},
});

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [activeProject, setActiveProject] = useState<PortalProject | null>(null);

  useEffect(() => {
    // Check for session token in URL hash (from magic link redirect)
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const session = hash.get('session');
    if (session) {
      localStorage.setItem('portal_session', session);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Verify session by fetching projects
    const stored = localStorage.getItem('portal_session');
    if (stored) {
      portalApi<PortalProject[]>('/portal/projects')
        .then(data => {
          setProjects(data);
          if (data.length > 0) setActiveProject(data[0]);
          setAuthenticated(true);
        })
        .catch(() => {
          localStorage.removeItem('portal_session');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('portal_session');
    setAuthenticated(false);
    window.location.href = '/login';
  };

  return (
    <PortalAuthContext.Provider value={{ authenticated, loading, projects, activeProject, setActiveProject, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
