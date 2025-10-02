"use client";

import { useEffect, useState } from 'react';

interface HydrationSafeWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component to prevent hydration mismatches caused by browser extensions
 * This ensures the component only renders on the client after hydration
 */
export default function HydrationSafeWrapper({ children }: HydrationSafeWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR and before hydration, render a minimal version
  if (!isHydrated) {
    return <div suppressHydrationWarning>{children}</div>;
  }

  // After hydration, render normally
  return <>{children}</>;
}
