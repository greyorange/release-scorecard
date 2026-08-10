// Feature Delivery card — visualizes the requirements data (planned vs
// delivered vs deferred) that the form/CSV already capture and the scorecard
// already scores (featureDelivery factor), but which nothing rendered before.

function FeatureList({ title, items, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className={`text-xs font-bold ${tone.text}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-center text-[11px] text-slate-400">
          none
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((f, i) => (
            <li
              key={i}
              className={`truncate rounded-md px-2 py-1 text-xs ring-1 ${tone.chip}`}
              title={f}
            >
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FeatureDelivery({ requirements, featureScore }) {
  const planned = requirements?.planned || [];
  const delivered = requirements?.delivered || [];
  const deferred = requirements?.deferred || [];

  const hasData = planned.length + delivered.length + deferred.length > 0;

  if (!hasData) {
    return (
      <div className="card">
        <h3 className="section-title">Feature Delivery</h3>
        <div className="text-center py-6 text-sm text-slate-400">
          No planned/delivered features logged for this release.
        </div>
      </div>
    );
  }

  // Delivery rate mirrors the scorecard's featureDelivery factor.
  const rate =
    planned.length > 0
      ? Math.round((delivered.length / planned.length) * 100)
      : featureScore ?? null;
  const barColor =
    rate == null ? "bg-slate-300" : rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title mb-0">Feature Delivery</h3>
        {rate != null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{rate}%</div>
            <div className="text-[11px] text-slate-500">delivered</div>
          </div>
        )}
      </div>

      {planned.length > 0 && (
        <div className="mb-4 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full transition-all ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <FeatureList
          title="Planned"
          items={planned}
          tone={{ text: "text-slate-600", chip: "bg-slate-50 ring-slate-200 text-slate-700" }}
        />
        <FeatureList
          title="Delivered"
          items={delivered}
          tone={{ text: "text-emerald-600", chip: "bg-emerald-50 ring-emerald-200 text-emerald-700" }}
        />
        <FeatureList
          title="Deferred"
          items={deferred}
          tone={{ text: "text-amber-600", chip: "bg-amber-50 ring-amber-200 text-amber-700" }}
        />
      </div>
    </div>
  );
}
