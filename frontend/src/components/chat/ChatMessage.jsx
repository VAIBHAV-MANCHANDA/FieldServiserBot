import DynamicChart from '../charts/DynamicChart.jsx'
import ResultsTable from '../dashboard/ResultsTable.jsx'
import { CHAT_MESSAGE_ROLES } from '../../types/chat.types.js'
import { formatTime, formatValue } from '../../utils/chartHelpers.js'

// ─── Palette: 5 distinct colourful card themes ───────────────────────────────
const CARD_PALETTES = [
  { bg: 'linear-gradient(135deg,#6d28d9,#7c3aed)', border: '#7c3aed', text: '#fff', sub: 'rgba(255,255,255,0.72)' },
  { bg: 'linear-gradient(135deg,#059669,#10b981)', border: '#10b981', text: '#fff', sub: 'rgba(255,255,255,0.72)' },
  { bg: 'linear-gradient(135deg,#d97706,#f59e0b)', border: '#f59e0b', text: '#fff', sub: 'rgba(255,255,255,0.72)' },
  { bg: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: '#3b82f6', text: '#fff', sub: 'rgba(255,255,255,0.72)' },
  { bg: 'linear-gradient(135deg,#db2777,#ec4899)', border: '#ec4899', text: '#fff', sub: 'rgba(255,255,255,0.72)' },
]

const METRIC_ICONS = {
  actual_hours: '⏱',
  avg: '📐',
  cancelled_count: '🚫',
  completed_count: '✅',
  completion_rate: '📊',
  employee_count: '👥',
  fill_rate: '📈',
  missed_count: '❌',
  record_count: '🗂️',
  rostered_hours: '📅',
  shift_count: '📋',
  total_groups: '🗃️',
  unfilled_count: '⬜',
}

function getIcon(label) {
  const key = label?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
  return METRIC_ICONS[key] ?? '📌'
}

// ─── 3 stat cards in a row ────────────────────────────────────────────────────
function StatCardsRow({ cards }) {
  if (!cards?.length) return null
  // Always show exactly 3 — slice to 3, or show all if fewer
  const visible = cards.slice(0, 3)
  return (
    <div className="msg-stat-row">
      {visible.map((card, i) => {
        const p = CARD_PALETTES[i % CARD_PALETTES.length]
        return (
          <div
            key={card.label + i}
            className="msg-stat-tile"
            style={{ background: p.bg, borderColor: p.border }}
          >
            <span className="msg-stat-tile__icon">{getIcon(card.label)}</span>
            <div>
              <p className="msg-stat-tile__label" style={{ color: p.sub }}>{card.label}</p>
              <p className="msg-stat-tile__value" style={{ color: p.text }}>
                {formatValue(card.value, card.format)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Insight text block below a chart ────────────────────────────────────────
function InsightText({ text, icon = '💡', color = '#6d28d9', bgColor = '#f5f3ff' }) {
  if (!text) return null
  return (
    <div className="msg-insight-block" style={{ '--ib-color': color, '--ib-bg': bgColor }}>
      <span className="msg-insight-block__icon" aria-hidden="true">{icon}</span>
      <p className="msg-insight-block__text">{text}</p>
    </div>
  )
}

// ─── Section label pill ───────────────────────────────────────────────────────
function SectionPill({ color = '#6d28d9', label }) {
  return (
    <div className="msg-section-pill-row">
      <span className="msg-section-pill" style={{ background: color }}>{label}</span>
    </div>
  )
}

// ─── Chart block: pill → chart → insight ─────────────────────────────────────
function ChartBlock({ chart, insight, insightBg, insightColor, insightIcon, label, pillColor, preferArea = false }) {
  if (!chart?.data?.length) return null
  return (
    <div className="msg-chart-block">
      <SectionPill label={label} color={pillColor} />
      <DynamicChart chart={chart} preferArea={preferArea} />
      <InsightText text={insight} icon={insightIcon} color={insightColor} bgColor={insightBg} />
    </div>
  )
}

// ─── Filter chips ─────────────────────────────────────────────────────────────
function FilterChips({ filters }) {
  const entries = Object.entries(filters ?? {}).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== undefined && v !== ''
  })
  if (!entries.length) return null
  return (
    <div className="msg-filters">
      {entries.map(([key, value]) => (
        <span key={key} className="msg-filter-chip">
          <span className="msg-filter-chip__key">{key.replaceAll('_', ' ')}</span>
          <span className="msg-filter-chip__val">
            {Array.isArray(value) ? value.join(', ') : String(value)}
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Follow-up chips ──────────────────────────────────────────────────────────
function FollowUps({ label = 'Follow-up', onSuggestion, questions }) {
  if (!questions?.length) return null
  return (
    <div className="msg-followups">
      <p className="msg-followups__label">{label}</p>
      <div className="msg-followups__chips">
        {questions.map((q) => (
          <button key={q} type="button" className="msg-followup-chip" onClick={() => onSuggestion?.(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ChatMessage({ message, onSuggestion }) {
  const isUser = message.role === CHAT_MESSAGE_ROLES.USER

  // ── User bubble ────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <article className="chat-message chat-message--user">
        <div className="chat-message__avatar" aria-hidden="true">You</div>
        <div className="chat-message__content">
          <div className="chat-message__header">
            <span className="chat-message__role">You</span>
            {message.timestamp && (
              <time className="chat-message__time" dateTime={message.timestamp}>
                {formatTime(message.timestamp)}
              </time>
            )}
          </div>
          <p className="chat-message__body">{message.content}</p>
        </div>
      </article>
    )
  }

  // ── Out-of-scope ───────────────────────────────────────────────────────
  if (message.outOfScope) {
    return (
      <article className="chat-message chat-message--assistant">
        <div className="chat-message__avatar" aria-hidden="true">AI</div>
        <div className="chat-message__content chat-message__content--report">
          <Header timestamp={message.timestamp} />
          <div className="msg-out-of-scope">
            <div className="msg-out-of-scope__icon" aria-hidden="true">🚧</div>
            <div className="msg-out-of-scope__body">
              <p className="msg-out-of-scope__title">Out of scope</p>
              <p className="msg-out-of-scope__text">{message.content}</p>
            </div>
          </div>
          <FollowUps label="Try asking" questions={message.suggestedQuestions} onSuggestion={onSuggestion} />
        </div>
      </article>
    )
  }

  // ── Full analytics response ────────────────────────────────────────────
  const hasCharts = message.lineChart?.data?.length
    || message.pieChart?.data?.length
    || message.barChart?.data?.length

  return (
    <article className="chat-message chat-message--assistant">
      <div className="chat-message__avatar" aria-hidden="true">AI</div>

      <div className="chat-message__content chat-message__content--report">

        <Header timestamp={message.timestamp} />

        {/* Understood query badge */}
        {message.understoodQuery && (
          <div className="msg-understood">
            <span className="msg-understood__icon" aria-hidden="true">🔍</span>
            <span>{message.understoodQuery}</span>
          </div>
        )}

        {/* Filter chips */}
        <FilterChips filters={message.appliedFilters} />

        {/* ── SECTION 1: 3 stat cards + overview text ───────────── */}
        <StatCardsRow cards={message.summaryCards} />
        <p className="msg-overview-text">{message.content}</p>

        {hasCharts && (
          <>
            {/* ── SECTION 2: Line chart + line insight ──────────── */}
            <ChartBlock
              chart={message.lineChart}
              insight={message.lineInsight}
              insightBg="#f0fdf4"
              insightColor="#15803d"
              insightIcon="📈"
              label="Trend"
              pillColor="#10b981"
              preferArea
            />

            {/* ── SECTION 3: Pie chart + pie insight ────────────── */}
            <ChartBlock
              chart={message.pieChart}
              insight={message.pieInsight}
              insightBg="#faf5ff"
              insightColor="#6d28d9"
              insightIcon="🍩"
              label="Distribution"
              pillColor="#7c3aed"
              preferArea={false}
            />

            {/* ── SECTION 4: Bar chart + bar insight ────────────── */}
            <ChartBlock
              chart={message.barChart}
              insight={message.barInsight}
              insightBg="#eff6ff"
              insightColor="#1d4ed8"
              insightIcon="📊"
              label="Comparison"
              pillColor="#2563eb"
              preferArea={false}
            />

            {/* ── SECTION 5: Data table ──────────────────────────── */}
            {message.table?.rows?.length ? (
              <div className="msg-chart-block">
                <SectionPill label="Data Table" color="#64748b" />
                <ResultsTable
                  columns={message.table.columns}
                  rows={message.table.rows}
                />
              </div>
            ) : null}
          </>
        )}

        {/* Follow-up chips */}
        <FollowUps questions={message.suggestedQuestions} onSuggestion={onSuggestion} />

      </div>
    </article>
  )
}

// ─── Shared header ────────────────────────────────────────────────────────────
function Header({ timestamp }) {
  return (
    <div className="chat-message__header">
      <span className="chat-message__role">Assistant</span>
      {timestamp && (
        <time className="chat-message__time" dateTime={timestamp}>
          {formatTime(timestamp)}
        </time>
      )}
    </div>
  )
}
