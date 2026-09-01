'use client'

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '@/components/AuthProvider';

export { AuthProvider } from '@/components/AuthProvider';
export type { AuthContextType };

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
