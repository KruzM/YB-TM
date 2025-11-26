// src/pages/Dashboard.jsx
export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Dashboard
      </h1>
      <p className="text-sm text-slate-600">
        This will become your high-level overview: today&apos;s tasks, upcoming
        deadlines, missing statements, etc.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-4 text-sm text-slate-700">
          <div className="font-semibold mb-1">Tasks</div>
          <div>0 open tasks (we&apos;ll wire this soon)</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-sm text-slate-700">
          <div className="font-semibold mb-1">Clients</div>
          <div>Client stats will go here.</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-sm text-slate-700">
          <div className="font-semibold mb-1">Alerts</div>
          <div>Missing statements / follow-ups will go here.</div>
        </div>
      </div>
    </div>
  );
}
