export default function SettingsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm max-w-2xl">Manage your profile & notification preferences. More security & API key options coming soon.</p>
      </header>
      <section className="glass-dark rounded-xl p-6 border border-white/10 space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Username</label>
            <input type="text" placeholder="Enter username" className="w-full bg-slate-800/60 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder:text-slate-500" />
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Email Notifications</label>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded bg-slate-800/60 border border-white/10" />
              <span className="text-slate-400 text-xs">Receive periodic platform updates</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="text-sm px-5 py-2 rounded-md bg-gradient-to-r from-brand-500 to-accent text-white font-medium hover:from-brand-400 hover:to-accent shadow-glow">Save Settings</button>
        </div>
      </section>
    </main>
  );
}
