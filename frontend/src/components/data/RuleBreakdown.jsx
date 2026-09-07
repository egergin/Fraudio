import { RULE_ORDER, RULES } from '@/lib/domain.js';

/**
 * Tetiklenen kuralların dağılımı — /api/frauds/recent örneklemi üzerinden.
 *
 * Kural açıklamaları burada tekrarlanmaz; bağlamıyla birlikte inceleme
 * çekmecesinde verilir.
 */
const BAR = {
  Velocity: 'bg-rule-velocity',
  Amount: 'bg-rule-amount',
  Location: 'bg-rule-location',
};

export function RuleBreakdown({ frauds }) {
  const total = frauds.length;

  return (
    <div className="flex flex-col gap-3 pt-3">
      {RULE_ORDER.map((key) => {
        const meta = RULES[key];
        const count = frauds.filter(
          (f) => Array.isArray(f.triggeredRules) && f.triggeredRules.includes(key)
        ).length;
        const share = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-fg-secondary">{meta.fullLabel}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-semibold tnum text-fg">{count}</span>
                <span className="text-2xs tnum text-fg-subtle">%{share.toFixed(0)}</span>
              </span>
            </div>
            <div
              role="meter"
              aria-valuenow={Math.round(share)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${meta.fullLabel} payı`}
              className="h-0.5 overflow-hidden bg-active"
            >
              <div
                className={`h-full transition-[width] duration-500 ${BAR[key]}`}
                style={{ width: `${share}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RuleBreakdown;
