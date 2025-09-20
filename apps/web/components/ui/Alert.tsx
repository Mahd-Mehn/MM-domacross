"use client";

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  duration?: number;
}

interface AlertContextType {
  showAlert: (type: AlertType, title: string, message?: string, duration?: number) => void;
  alerts: Alert[];
  removeAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const showAlert = useCallback((
    type: AlertType,
    title: string,
    message?: string,
    duration: number = 5000
  ) => {
    const id = Date.now().toString();
    const newAlert: Alert = { id, type, title, message, duration };
    
    setAlerts((prev) => [...prev, newAlert]);

    if (duration > 0) {
      setTimeout(() => removeAlert(id), duration);
    }
  }, [removeAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, alerts, removeAlert }}>
      {children}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
    </AlertContext.Provider>
  );
}

function AlertContainer({ 
  alerts, 
  onRemove 
}: { 
  alerts: Alert[]; 
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onRemove={onRemove} />
      ))}
    </div>
  );
}

function AlertItem({ 
  alert, 
  onRemove 
}: { 
  alert: Alert; 
  onRemove: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss
    if (alert.duration && alert.duration > 0) {
      const exitTimeout = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(alert.id), 300);
      }, alert.duration);

      return () => clearTimeout(exitTimeout);
    }
  }, [alert.duration, alert.id, onRemove]);

  const getIcon = () => {
    switch (alert.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (alert.type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20 shadow-green-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20 shadow-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20 shadow-yellow-500/20';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20 shadow-blue-500/20';
    }
  };

  const getProgressColor = () => {
    switch (alert.type) {
      case 'success':
        return 'bg-green-400';
      case 'error':
        return 'bg-red-400';
      case 'warning':
        return 'bg-yellow-400';
      case 'info':
        return 'bg-blue-400';
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(alert.id), 300);
  };

  return (
    <div
      className={`
        pointer-events-auto
        relative min-w-[350px] max-w-[450px] p-4
        bg-slate-900/95 backdrop-blur-xl
        border rounded-lg shadow-2xl
        transform transition-all duration-300 ease-out
        ${getStyles()}
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{alert.title}</p>
          {alert.message && (
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{alert.message}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-2 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      {alert.duration && alert.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-b-lg overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} animate-progress`}
            style={{
              animationDuration: `${alert.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Inline modal alert for critical actions
export function ModalAlert({ 
  isOpen, 
  onClose, 
  onConfirm,
  type = 'warning',
  title, 
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-400" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-12 h-12 text-yellow-400" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-400" />;
    }
  };

  const getButtonStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50';
      case 'error':
        return 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/50';
      case 'info':
        return 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">{getIcon()}</div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-white/10"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg transition-colors border font-medium ${getButtonStyle()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add this CSS to your global styles
export const alertStyles = `
@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.animate-progress {
  animation: progress linear forwards;
}
`;
