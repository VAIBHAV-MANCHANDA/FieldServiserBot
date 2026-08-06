import { formatValue } from '../../utils/chartHelpers.js'

const ICON_COLORS = [
  'var(--accent)',
  'var(--chart-emerald)',
  'var(--chart-amber)',
  'var(--chart-rose)',
  'var(--chart-sky)',
]

/**
 * Compact summary card — used inside chart panels as sub-metrics.
 *
 * @param {object} props
 * @param {string}  props.label
 * @param {number|string} props.value
 * @param {string}  [props.format]
 * @param {string}  [props.caption]
 * @param {number}  [props.colorIndex] - 0–4, picks icon accent color
 * @param {string}  [props.icon]       - Short text / symbol for the icon cell
 * @param {number}  [props.trend]      - % change, shown as colored badge
 */
export default function SummaryCard({
  caption,
  colorIndex = 0,
  format = 'number',
  icon = '#',
  label,
  trend,
  value,
}) {
  const accentColor = ICON_COLORS[colorIndex % ICON_COLORS.length]
  const hasTrend = trend !== undefined && trend !== null
  const trendUp = hasTrend && trend >= 0

  return (
    <article className="summary-card">
      <div
        className="summary-card__icon"
        aria-hidden="true"
        style={{ background: `${accentColor}18`, color: accentColor }}
      >
        {icon}
      </div>
      <div className="summary-card__body">
        <p className="summary-card__title">{label}</p>
        <p className="summary-card__value">{formatValue(value, format)}</p>
        {caption ? <p className="summary-card__caption">{caption}</p> : null}
      </div>
      {hasTrend ? (
        <span className={`summary-card__trend ${trendUp ? 'summary-card__trend--up' : 'summary-card__trend--down'}`}>
          {trendUp ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
      ) : null}
    </article>
  )
}
