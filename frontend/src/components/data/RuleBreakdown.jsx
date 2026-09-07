import { RULE_ORDER, RULES } from '../../lib/domain.js';

/**
 * Tetiklenen kuralların dağılımı — /api/frauds/recent örneklemi üzerinden.
 * Kural açıklaması burada tekrarlanmaz; inceleme çekmecesinde bağlamıyla verilir.
 */
export function RuleBreakdown({ frauds }) {
  const total = frauds.length;

  const counts = RULE_ORDER.map((ruleKey) => {
    const count = frauds.filter((fraud) =>
      Array.isArray(fraud.triggeredRules) && fraud.triggeredRules.includes(ruleKey)
    ).length;
    return { ruleKey, meta: RULES[ruleKey], count };
  });

  return (
    <div>
      {counts.map(({ ruleKey, meta, count }) => {
        const share = total > 0 ? (count / total) * 100 : 0;
        return (
          <div className="meter" key={ruleKey}>
            <div className="meter__head">
              <span className="meter__name">
                <span
                  className="chart-legend__swatch"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                {meta.fullLabel}
              </span>
              <span className="meter__value">
                {count}
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    marginLeft: 6,
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  %{share.toFixed(0)}
                </span>
              </span>
            </div>
            <div
              className="meter__track"
              role="meter"
              aria-valuenow={Math.round(share)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${meta.fullLabel} payı`}
            >
              <div
                className="meter__fill"
                data-rule={meta.key}
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
