"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  clearCurrentUser,
  getCurrentUser,
  setCurrentUser,
  signOutUser,
  type AuthUser,
} from "../lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getCurrentUser();
    setUser(stored);
    setIsLoading(false);
  }, []);

  function login(nextUser: AuthUser) {
    setCurrentUser(nextUser);
    setUser(nextUser);
  }

  async function logout() {
    await signOutUser();
    clearCurrentUser();
    setUser(null);
  }

  function updateUser(updates: Partial<AuthUser>) {
    if (!user) {
      return;
    }

    const updated = { ...user, ...updates };
    setCurrentUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}