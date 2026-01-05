'use client';

import { NavigationConfigProvider } from '@/contexts/NavigationConfigContext';

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return <NavigationConfigProvider>{children}</NavigationConfigProvider>;
}
