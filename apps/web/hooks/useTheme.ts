"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';

// Central theme tokens (scales) for charts & UI surfaces.
// Extend or override via <ThemeProvider value={...}> at root layout if desired.
export interface ThemeTokens {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentAlt: string;
    danger: string;
    warning: string;
    success: string;
    grid: string;
    chartPalette: string[];
  };
  radii: { sm:number; md:number; lg:number };
  durations: { fast:string; normal:string };
}

const defaultTheme: ThemeTokens = {
  dark: true,
  colors: {
    background: '#0b121b',
    surface: '#111c29',
    surfaceAlt: '#182635',
    border: '#1e293b',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    accent: '#1d75ff',
    accentAlt: '#7b5cff',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#16a34a',
    grid: 'rgba(255,255,255,0.06)',
    chartPalette: ['#1d75ff','#7b5cff','#16a34a','#f59e0b','#ef4444','#06b6d4','#e11d48']
  },
  radii: { sm:4, md:8, lg:14 },
  durations: { fast:'120ms', normal:'220ms' }
};

const ThemeContext = createContext<ThemeTokens>(defaultTheme);

export function ThemeProvider({ value, children }: { value?: Partial<ThemeTokens>; children: any }){
  const merged: ThemeTokens = { ...defaultTheme, ...(value||{}), colors: { ...defaultTheme.colors, ...(value?.colors||{}) } };
  return React.createElement(ThemeContext.Provider, { value: merged }, children);
}

export function useTheme(){
  return useContext(ThemeContext);
}

// Optional system dark-mode sync for future use
export function useSystemDarkMode(pref?: boolean){
  const [dark,setDark]=useState(pref ?? true);
  useEffect(()=>{
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e:MediaQueryListEvent)=> setDark(e.matches);
    setDark(mq.matches);
    mq.addEventListener('change', listener);
    return ()=> mq.removeEventListener('change', listener);
  },[]);
  return dark;
}
