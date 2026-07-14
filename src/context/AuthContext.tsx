import React, { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import {
  signIn as cogSignIn,
  signOut as cogSignOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import { apiGet, apiPost } from '../services/api';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
});

type UserRole = 'psicologo' | 'colaborador' | null;

interface AuthContextType {
  user: any;
  role: UserRole;
  profile: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, empresaId: string, empresaNome?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const refreshToken = async () => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || '';
  localStorage.setItem('access_token', token);
  return token;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (u) => {
        await refreshToken();
        setUser(u);
        const prof = await apiGet<any>(`/profiles/${u.userId}`);
        setProfile(prof);
        setRole(prof.tipo as UserRole);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await cogSignIn({ username: email, password });
    } catch (e: any) {
      if (e.name === 'UserAlreadyAuthenticatedException') {
        await cogSignOut();
        await cogSignIn({ username: email, password });
      } else {
        throw e;
      }
    }
    const u = await getCurrentUser();
    await refreshToken();
    setUser(u);
    const prof = await apiGet<any>(`/profiles/${u.userId}`);
    setProfile(prof);
    setRole(prof.tipo as UserRole);
  };

  const signUp = async (email: string, password: string, fullName: string, empresaId: string, empresaNome?: string) => {
    await apiPost('/api/create-user', {
      email,
      password,
      nome: fullName,
      tipo: 'colaborador',
      empresa_id: empresaId,
      empresa_nome: empresaNome,
    });
    await signIn(email, password);
  };

  const signOut = async () => {
    await cogSignOut();
    localStorage.removeItem('access_token');
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
