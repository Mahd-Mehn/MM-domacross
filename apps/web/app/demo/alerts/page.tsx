"use client";

import { useState } from 'react';
import { useAlert, ModalAlert } from '@/components/ui/Alert';
import { Bell, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

export default function AlertDemo() {
  const { showAlert } = useAlert();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'warning' | 'info'>('warning');

  const examples = [
    {
      type: 'success' as const,
      title: 'Transaction Successful',
      message: 'Your domain has been successfully listed for 5 ETH. It is now visible to potential buyers.',
      icon: CheckCircle,
      color: 'green',
    },
    {
      type: 'error' as const,
      title: 'Transaction Failed',
      message: 'Unable to process your offer. Please ensure you have sufficient funds and try again.',
      icon: XCircle,
      color: 'red',
    },
    {
      type: 'warning' as const,
      title: 'Low Health Factor',
      message: 'Your collateral position health factor is below 1.5. Consider adding more collateral to avoid liquidation.',
      icon: AlertCircle,
      color: 'yellow',
    },
    {
      type: 'info' as const,
      title: 'Market Update',
      message: 'The funding rate for crypto.eth futures has been updated to 0.015%. Next funding in 3 hours.',
      icon: Info,
      color: 'blue',
    },
  ];

  const getButtonStyle = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50';
      case 'red':
        return 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50';
      case 'yellow':
        return 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/50';
      case 'blue':
        return 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/50';
      default:
        return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-brand-500/20 rounded-lg">
            <Bell className="w-8 h-8 text-brand-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-300 via-accent to-brand-500 bg-clip-text text-transparent">
              Alert System Demo
            </h1>
            <p className="text-slate-400 mt-1">
              Beautiful, themed alerts for the DomaCross platform
            </p>
          </div>
        </div>
      </div>

      {/* Toast Examples */}
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Toast Notifications</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examples.map((example, index) => (
              <div
                key={index}
                className="bg-slate-800/50 rounded-lg border border-white/5 p-4"
              >
                <div className="flex items-start gap-3 mb-4">
                  <example.icon className={`w-5 h-5 text-${example.color}-400`} />
                  <div className="flex-1">
                    <p className="text-white font-medium mb-1">{example.title}</p>
                    <p className="text-sm text-slate-400">{example.message}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => showAlert(example.type, example.title, example.message)}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-all border ${getButtonStyle(example.color)}`}
                >
                  Show {example.type} Alert
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-white/5">
            <p className="text-sm text-slate-400 mb-3">
              <strong className="text-white">Usage:</strong> Import and use the alert hook in your components
            </p>
            <pre className="text-xs bg-slate-900 p-3 rounded overflow-x-auto">
              <code className="text-green-400">{`import { useAlert } from '../components/ui/Alert';

const { showAlert } = useAlert();

// Show alert
showAlert('success', 'Title', 'Message');`}</code>
            </pre>
          </div>
        </div>

        {/* Modal Examples */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Modal Alerts</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setModalType('warning');
                setShowModal(true);
              }}
              className="p-4 bg-slate-800/50 rounded-lg border border-white/5 hover:border-yellow-500/50 transition-all"
            >
              <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-white font-medium">Confirmation Modal</p>
              <p className="text-sm text-slate-400 mt-1">
                For important actions that need confirmation
              </p>
            </button>

            <button
              onClick={() => {
                setModalType('error');
                setShowModal(true);
              }}
              className="p-4 bg-slate-800/50 rounded-lg border border-white/5 hover:border-red-500/50 transition-all"
            >
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-white font-medium">Critical Warning</p>
              <p className="text-sm text-slate-400 mt-1">
                For destructive or irreversible actions
              </p>
            </button>
          </div>
        </div>

        {/* Custom Duration */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Custom Duration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => showAlert('info', 'Quick Alert', 'This will disappear in 2 seconds', 2000)}
              className="px-4 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all border border-blue-500/50"
            >
              2 Second Alert
            </button>
            
            <button
              onClick={() => showAlert('success', 'Standard Alert', 'This will disappear in 5 seconds', 5000)}
              className="px-4 py-3 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all border border-green-500/50"
            >
              5 Second Alert (Default)
            </button>
            
            <button
              onClick={() => showAlert('warning', 'Persistent Alert', 'This will stay for 10 seconds', 10000)}
              className="px-4 py-3 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all border border-yellow-500/50"
            >
              10 Second Alert
            </button>
          </div>
        </div>

        {/* Multiple Alerts */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Stacked Alerts</h2>
          
          <button
            onClick={() => {
              showAlert('success', 'First Alert', 'This is the first notification');
              setTimeout(() => showAlert('info', 'Second Alert', 'This stacks below the first'), 500);
              setTimeout(() => showAlert('warning', 'Third Alert', 'Multiple alerts can be shown'), 1000);
            }}
            className="px-6 py-3 bg-gradient-to-r from-brand-500 to-accent text-white font-medium rounded-lg hover:opacity-90 transition-all"
          >
            Show Multiple Alerts
          </button>
        </div>
      </div>

      {/* Modal */}
      <ModalAlert
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={() => {
          showAlert('success', 'Action Confirmed', 'The action has been successfully completed.');
        }}
        type={modalType}
        title={modalType === 'warning' ? 'Confirm Action' : 'Critical Warning'}
        message={
          modalType === 'warning'
            ? 'Are you sure you want to proceed? This action may have significant consequences.'
            : 'This action is irreversible and will permanently affect your position. Are you absolutely sure?'
        }
        confirmText={modalType === 'error' ? 'Yes, I understand' : 'Confirm'}
        cancelText="Cancel"
      />
    </div>
  );
}
