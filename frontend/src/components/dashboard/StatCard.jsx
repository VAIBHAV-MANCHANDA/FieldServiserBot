import { formatValue } from '../../utils/chartHelpers.js'

const STATUS_CONFIG = {
  'on-track': { label: 'On track', className: 'stat-card__badge--success' },
  'needs-action': { label: 'Needs action', className: 'stat-card__badge--danger' },
  'warning': { label: 'Warning', className: 'stat-card__badge--warning' },
  'neutral': { label: '', className: 'stat-card__badge--neutral' },
}

/**
 * Large KPI stat card — matches the reference "344 · on track" pattern.
 *
 * @param {object} props
 * @param {string}  props.label        - Metric label e.g. "Total Shifts"
 * @param {string}  [props.sublabel]   - Secondary descriptor e.g. "Across all sites"
 * @param {number|string} props.value  - The numeric (or string) KPI value
 * @param {string}  [props.format]     - formatValue format key
 * @param {'on-track'|'needs-action'|'warning'|'neutral'} [props.status]
 * @param {string}  [props.icon]       - Short icon text / emoji
 * @param {string}  [props.accentColor] - CSS variable name or hex for the left border accent
 * @param {number}  [props.trend]      - positive = up, negative = down, undefined = hidden
 * @param {string}  [props.trendLabel] - e.g. "vs last week"
 */
export default function StatCard({
  accentColor,
  format = 'number',
  icon,
  label,
  status = 'neutral',
  sublabel,
  trend,
  trendLabel,
  value,
}) {
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral
  const hasTrend = trend !== undefined && trend !== null
  const trendUp = hasTrend && trend >= 0

  return (
    <article
      className="stat-card"
      style={accentColor ? { '--stat-accent': accentColor } : undefined}
    >
      <div className="stat-card__top">
        {icon ? (
          <span className="stat-card__icon" aria-hidden="true">{icon}</span>
        ) : null}
        <div className="stat-card__meta">
          <p className="stat-card__label">{label}</p>
          {sublabel ? <p className="stat-card__sublabel">{sublabel}</p> : null}
        </div>
      </div>

      <div className="stat-card__bottom">
        <p className="stat-card__value">{formatValue(value, format)}</p>
        <div className="stat-card__footer">
          {statusCfg.label ? (
            <span className={`stat-card__badge ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
          ) : null}
          {hasTrend ? (
            <span className={`stat-card__trend ${trendUp ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
              <span className="stat-card__trend-arrow" aria-hidden="true">
                {trendUp ? '▲' : '▼'}
              </span>
              {Math.abs(trend)}%
              {trendLabel ? <span className="stat-card__trend-label">{trendLabel}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
