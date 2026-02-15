import goalsData from '../../../data/goals.json';

type Goal = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  targetDate?: string;
};

const goals = goalsData as Goal[];

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <p className="text-slate-400">Loaded from <code className="text-slate-300">data/goals.json</code>.</p>
      </div>

      <div className="space-y-3">
        {goals.map((g) => (
          <div
            key={g.id}
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-medium text-slate-100">{g.title}</div>
                {g.description ? (
                  <div className="mt-1 text-sm text-slate-400">{g.description}</div>
                ) : null}
              </div>

              <div className="hidden md:block text-right text-xs text-slate-400">
                <div>Status: <span className="text-slate-300">{g.status ?? '—'}</span></div>
                <div>Priority: <span className="text-slate-300">{g.priority ?? '—'}</span></div>
                <div>Target date: <span className="text-slate-300">{g.targetDate ?? '—'}</span></div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400 md:hidden">
              <div className="rounded border border-slate-800 px-2 py-1">
                Status: <span className="text-slate-300">{g.status ?? '—'}</span>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1">
                Priority: <span className="text-slate-300">{g.priority ?? '—'}</span>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1">
                Target: <span className="text-slate-300">{g.targetDate ?? '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
