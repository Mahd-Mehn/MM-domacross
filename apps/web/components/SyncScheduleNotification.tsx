"use client";

import { useState, useEffect } from 'react';
import { Clock, RefreshCw, Info, ChevronDown, ChevronUp, Sparkles, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SyncStatus {
  sync_schedule: {
    frequency: string;
    interval_hours: number;
    sync_times: string[];
  };
  next_sync_estimate: {
    hours_remaining: number;
    next_sync_time: string;
  };
  info: {
    message: string;
    manual_sync_available: boolean;
  };
}

export function SyncScheduleNotification() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { data: syncStatus, isLoading } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sync/status`);
      if (!response.ok) throw new Error('Failed to fetch sync status');
      return response.json();
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Minimized floating button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 group"
        style={{ zIndex: 40 }}
      >
        <div className="relative">
          {/* Pulsing ring animation */}
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
          
          {/* Main button */}
          <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </div>
          
          {/* Tooltip on hover */}
          {isHovered && (
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Sync Schedule</span>
              </div>
              <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
            </div>
          )}
        </div>
      </button>
    );
  }

  if (!syncStatus) {
    return (
      <div className="fixed bottom-6 right-6 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl" style={{ zIndex: 40 }}>
        <div className="flex items-center gap-2 text-slate-300">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading sync info...</span>
        </div>
      </div>
    );
  }

  // Calculate progress percentage
  const totalHours = syncStatus.sync_schedule.interval_hours;
  const remainingHours = syncStatus.next_sync_estimate.hours_remaining;
  const progressPercent = ((totalHours - remainingHours) / totalHours) * 100;

  return (
    <div 
      className="fixed bottom-6 right-6 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300"
      style={{ zIndex: 40 }}
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              {/* Live indicator */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Sync Schedule</h3>
              <p className="text-xs text-slate-400">{syncStatus.sync_schedule.frequency}</p>
            </div>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 space-y-3">
        {/* Next sync info */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Next sync in
            </span>
            <span className="font-mono text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {remainingHours}h
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Scheduled for</span>
            <span className="font-mono text-purple-400 font-semibold">
              {syncStatus.next_sync_estimate.next_sync_time}
            </span>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between text-sm text-slate-300 hover:text-white transition-colors p-2 hover:bg-slate-800/50 rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            {showDetails ? 'Hide' : 'Show'} Schedule Details
          </span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDetails && (
          <div className="bg-slate-800/30 rounded-lg p-3 space-y-3 animate-in slide-in-from-top-2">
            <div>
              <p className="text-xs text-slate-400 mb-2">Daily Sync Times (UTC)</p>
              <div className="grid grid-cols-2 gap-2">
                {syncStatus.sync_schedule.sync_times.map((time, idx) => (
                  <div key={idx} className="bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg text-center">
                    <span className="text-sm font-mono text-blue-300">{time}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 leading-relaxed">
                {syncStatus.info.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fun fact footer */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 px-4 py-2 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 text-center">
          💡 Tip: Data refreshes automatically - no action needed!
        </p>
      </div>
    </div>
  );
}
