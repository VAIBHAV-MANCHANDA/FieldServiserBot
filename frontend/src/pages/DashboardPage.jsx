import { useCallback, useEffect, useReducer } from 'react'
import { executeReport } from '../api/reportApi.js'
import DynamicChart from '../components/charts/DynamicChart.jsx'
import ErrorMessage from '../components/common/ErrorMessage.jsx'
import Loader from '../components/common/Loader.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'

// ─── Today / date-range helpers ───────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  attendanceChart: null,
  currentlyIn: null,
  error: null,
  financialChart: null,
  kpi: null,
  loading: true,
  missedChart: null,
  overtimeChart: null,
  siteChart: null,
  topEmployees: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_KPI':
      return { ...state, kpi: action.payload }
    case 'SET_FINANCIAL':
      return { ...state, financialChart: action.payload }
    case 'SET_SITE':
      return { ...state, siteChart: action.payload }
    case 'SET_ATTENDANCE':
      return { ...state, attendanceChart: action.payload }
    case 'SET_MISSED':
      return { ...state, missedChart: action.payload }
    case 'SET_OVERTIME':
      return { ...state, overtimeChart: action.payload }
    case 'SET_CURRENTLY_IN':
      return { ...state, currentlyIn: action.payload }
    case 'SET_TOP_EMPLOYEES':
      return { ...state, topEmployees: action.payload }
    default:
      return state
  }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function DashboardSection({ children, subtitle, title }) {
  return (
    <section className="dash-section">
      <header className="dash-section__header">
        <h2 className="dash-section__title">{title}</h2>
        {subtitle ? <p className="dash-section__subtitle">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function WidgetMeta({ count, label = 'metrics verified' }) {
  return (
    <div className="widget-meta">
      <span className="widget-meta__dot" aria-hidden="true" />
      <span>{count} {label}</span>
    </div>
  )
}

// ─── Mini table for top performers ───────────────────────────────────────────
function MiniTable({ columns, rows, title, subtitle }) {
  if (!rows?.length) return null
  return (
    <section className="panel mini-table">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">TABLE</p>
          <h3 className="panel__title">{title}</h3>
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="mini-table__body">
        <table>
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Attendance exception pill ────────────────────────────────────────────────
function AttendancePill({ value }) {
  if (!value || value === 0 || value === '0') return <span className="apill apill--ok">0</span>
  return <span className="apill apill--warn">{value}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const start30 = daysAgoISO(30)
  const start7 = daysAgoISO(7)
  const end = todayISO()

  const loadAll = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    const calls = [
      // KPI: shift status summary last 30 days, grouped by status
      executeReport({
        reportType: 'shift_status_summary',
        groupBy: 'shift_status',
        metrics: ['shift_count', 'completed_count', 'missed_count', 'fill_rate'],
        chartType: 'pie',
        startDate: start30,
        endDate: end,
      }),
      // Financial line chart — monthly revenue/wages/profit
      executeReport({
        reportType: 'financial_summary',
        groupBy: 'month',
        metrics: ['revenue', 'wages', 'gross_profit'],
        chartType: 'line',
        startDate: daysAgoISO(180),
        endDate: end,
      }),
      // Site performance bar chart
      executeReport({
        reportType: 'site_performance',
        groupBy: 'site',
        metrics: ['shift_count', 'gross_profit'],
        chartType: 'bar',
        startDate: start30,
        endDate: end,
      }),
      // Attendance exceptions last 30 days
      executeReport({
        reportType: 'attendance_exceptions',
        groupBy: 'employee',
        metrics: ['late_count', 'missed_count'],
        chartType: 'bar',
        startDate: start30,
        endDate: end,
        sortBy: 'late_count',
        sortOrder: 'desc',
        limit: 10,
      }),
      // Missed shifts by site last 30 days
      executeReport({
        reportType: 'missed_shifts',
        groupBy: 'site',
        metrics: ['missed_count'],
        chartType: 'bar',
        startDate: start30,
        endDate: end,
      }),
      // Overtime summary by employee
      executeReport({
        reportType: 'overtime_summary',
        groupBy: 'employee',
        metrics: ['overtime_hours'],
        chartType: 'bar',
        startDate: start30,
        endDate: end,
        sortBy: 'overtime_hours',
        sortOrder: 'desc',
        limit: 10,
      }),
      // Currently clocked in (live)
      executeReport({
        reportType: 'currently_clocked_in',
        groupBy: 'site',
        metrics: ['shift_count'],
        chartType: 'bar',
      }),
      // Employee hours last 7 days
      executeReport({
        reportType: 'employee_hours',
        groupBy: 'employee',
        metrics: ['rostered_hours', 'actual_hours'],
        chartType: 'bar',
        startDate: start7,
        endDate: end,
        sortBy: 'actual_hours',
        sortOrder: 'desc',
        limit: 10,
      }),
    ]

    try {
      const [
        kpiResult,
        financialResult,
        siteResult,
        attendanceResult,
        missedResult,
        overtimeResult,
        currentlyInResult,
        topEmployeesResult,
      ] = await Promise.allSettled(calls)

      dispatch({ type: 'SET_KPI', payload: kpiResult.status === 'fulfilled' ? kpiResult.value : null })
      dispatch({ type: 'SET_FINANCIAL', payload: financialResult.status === 'fulfilled' ? financialResult.value : null })
      dispatch({ type: 'SET_SITE', payload: siteResult.status === 'fulfilled' ? siteResult.value : null })
      dispatch({ type: 'SET_ATTENDANCE', payload: attendanceResult.status === 'fulfilled' ? attendanceResult.value : null })
      dispatch({ type: 'SET_MISSED', payload: missedResult.status === 'fulfilled' ? missedResult.value : null })
      dispatch({ type: 'SET_OVERTIME', payload: overtimeResult.status === 'fulfilled' ? overtimeResult.value : null })
      dispatch({ type: 'SET_CURRENTLY_IN', payload: currentlyInResult.status === 'fulfilled' ? currentlyInResult.value : null })
      dispatch({ type: 'SET_TOP_EMPLOYEES', payload: topEmployeesResult.status === 'fulfilled' ? topEmployeesResult.value : null })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [start30, start7, end])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ── KPI derivation from shift_status_summary ────────────────────────────
  const kpiCards = deriveKpiCards(state.kpi, state.currentlyIn)

  if (state.loading) {
    return (
      <div className="page dash-loading">
        <Loader label="Loading dashboard data…" />
      </div>
    )
  }

  return (
    <div className="page dash-page">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="dash-hero">
        <div className="dash-hero__copy">
          <h1 className="dash-hero__title">Operations Overview</h1>
          <p className="dash-hero__sub">Live metrics from your workforce data · Last 30 days</p>
        </div>
        <button
          type="button"
          className="dash-refresh-btn"
          onClick={loadAll}
          title="Refresh dashboard"
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>

      <ErrorMessage message={state.error} />

      {/* ── KPI stat cards ────────────────────────────────────────────── */}
      <DashboardSection title="At a Glance" subtitle="Key performance indicators across all sites">
        <WidgetMeta count={kpiCards.length} label="metrics verified" />
        <div className="dash-kpi-grid">
          {kpiCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </DashboardSection>

      {/* ── Financial + Site ─────────────────────────────────────────── */}
      <DashboardSection title="Financial Performance" subtitle="Revenue, wages, and gross profit over time">
        <div className="dash-main-grid">
          {state.financialChart?.lineChart ?? state.financialChart?.chart ? (
            <DynamicChart chart={state.financialChart.lineChart ?? state.financialChart.chart} preferArea />
          ) : (
            <ChartSkeleton title="Financial Summary" />
          )}
          {state.siteChart?.barChart ?? state.siteChart?.chart ? (
            <DynamicChart chart={state.siteChart.barChart ?? state.siteChart.chart} preferArea={false} />
          ) : (
            <ChartSkeleton title="Site Performance" />
          )}
        </div>
      </DashboardSection>

      {/* ── Shift status donut + Currently in ───────────────────────── */}
      <DashboardSection title="Shift Activity" subtitle="Status breakdown and live clock-ins">
        <div className="dash-main-grid">
          {state.kpi?.pieChart ?? state.kpi?.chart ? (
            <DynamicChart chart={state.kpi.pieChart ?? { ...state.kpi.chart, type: 'pie' }} preferArea={false} />
          ) : (
            <ChartSkeleton title="Shift Status Breakdown" />
          )}
          {state.currentlyIn?.barChart ?? state.currentlyIn?.chart ? (
            <DynamicChart chart={state.currentlyIn.barChart ?? state.currentlyIn.chart} preferArea={false} />
          ) : (
            <ChartSkeleton title="Currently Clocked In by Site" />
          )}
        </div>
      </DashboardSection>

      {/* ── Attendance + Overtime ─────────────────────────────────────── */}
      <DashboardSection title="Attendance & Exceptions" subtitle="Late clock-ins, missed shifts, and overtime · last 30 days">
        <div className="dash-triple-grid">
          {state.attendanceChart?.barChart ?? state.attendanceChart?.chart ? (
            <DynamicChart chart={state.attendanceChart.barChart ?? state.attendanceChart.chart} preferArea={false} />
          ) : (
            <ChartSkeleton title="Attendance Exceptions by Employee" />
          )}
          {state.missedChart?.barChart ?? state.missedChart?.chart ? (
            <DynamicChart chart={state.missedChart.barChart ?? state.missedChart.chart} preferArea={false} />
          ) : (
            <ChartSkeleton title="Missed Shifts by Site" />
          )}
          {state.overtimeChart?.barChart ?? state.overtimeChart?.chart ? (
            <DynamicChart chart={state.overtimeChart.barChart ?? state.overtimeChart.chart} preferArea={false} />
          ) : (
            <ChartSkeleton title="Overtime by Employee" />
          )}
        </div>
      </DashboardSection>

      {/* ── Employee hours table ──────────────────────────────────────── */}
      <DashboardSection title="Top Employees" subtitle="Rostered vs actual hours · last 7 days">
        <div className="dash-table-grid">
          <MiniTable
            title="Employee Hours"
            subtitle="Sorted by actual hours worked"
            columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'rostered_hours', label: 'Rostered h', render: (v) => v != null ? `${Number(v).toFixed(1)}h` : '—' },
              { key: 'actual_hours', label: 'Actual h', render: (v) => v != null ? `${Number(v).toFixed(1)}h` : '—' },
              {
                key: 'actual_hours',
                label: 'Variance',
                render: (v, row) => {
                  const diff = Number(v ?? 0) - Number(row.rostered_hours ?? 0)
                  const cls = diff >= 0 ? 'apill apill--ok' : 'apill apill--warn'
                  return <span className={cls}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}h</span>
                },
              },
            ]}
            rows={state.topEmployees?.table?.rows ?? []}
          />
          <MiniTable
            title="Attendance Exceptions"
            subtitle="Employees with late or missed shifts"
            columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'late_count', label: 'Late', render: (v) => <AttendancePill value={v} /> },
              { key: 'missed_count', label: 'Missed', render: (v) => <AttendancePill value={v} /> },
            ]}
            rows={state.attendanceChart?.table?.rows ?? []}
          />
        </div>
      </DashboardSection>
    </div>
  )
}

// ─── Helper: derive KPI stat cards from API results ──────────────────────────
function deriveKpiCards(kpiResult, currentlyIn) {
  const cards = []

  if (kpiResult?.summaryCards?.length) {
    const lookup = Object.fromEntries(
      kpiResult.summaryCards.map((c) => [c.label?.toLowerCase().replace(/\s+/g, '_'), c])
    )

    const shiftCard = kpiResult.summaryCards.find(
      (c) => /shift.count|total.shift/i.test(c.label)
    )
    const completedCard = kpiResult.summaryCards.find(
      (c) => /complet/i.test(c.label)
    )
    const missedCard = kpiResult.summaryCards.find(
      (c) => /missed/i.test(c.label)
    )
    const fillCard = kpiResult.summaryCards.find(
      (c) => /fill.rate/i.test(c.label)
    )

    if (shiftCard) {
      cards.push({
        label: shiftCard.label,
        sublabel: 'Across all sites',
        value: shiftCard.value,
        format: shiftCard.format ?? 'number',
        status: 'on-track',
        icon: '📋',
        accentColor: '#6d28d9',
      })
    }
    if (completedCard) {
      cards.push({
        label: completedCard.label,
        sublabel: 'Last 30 days',
        value: completedCard.value,
        format: completedCard.format ?? 'number',
        status: 'on-track',
        icon: '✅',
        accentColor: '#10b981',
      })
    }
    if (missedCard) {
      const missed = Number(missedCard.value ?? 0)
      cards.push({
        label: missedCard.label,
        sublabel: 'Requires review',
        value: missedCard.value,
        format: missedCard.format ?? 'number',
        status: missed > 0 ? 'needs-action' : 'on-track',
        icon: '⚠️',
        accentColor: '#ef4444',
      })
    }
    if (fillCard) {
      const rate = Number(fillCard.value ?? 0)
      cards.push({
        label: fillCard.label,
        sublabel: 'Shifts filled',
        value: fillCard.value,
        format: fillCard.format ?? 'percentage',
        status: rate >= 90 ? 'on-track' : rate >= 75 ? 'warning' : 'needs-action',
        icon: '📈',
        accentColor: '#f59e0b',
      })
    }

    // Fallback: show first 4 summary cards that didn't map above
    if (cards.length === 0) {
      kpiResult.summaryCards.slice(0, 4).forEach((c, i) => {
        const ICONS = ['📋', '✅', '⚠️', '📈']
        const COLORS = ['#6d28d9', '#10b981', '#f59e0b', '#ef4444']
        cards.push({
          label: c.label,
          sublabel: 'Across all sites',
          value: c.value,
          format: c.format ?? 'number',
          status: 'neutral',
          icon: ICONS[i],
          accentColor: COLORS[i],
        })
      })
    }
  }

  // Live clock-in count
  if (currentlyIn?.summaryCards?.length) {
    const liveCard = currentlyIn.summaryCards[0]
    cards.push({
      label: 'Staff on site now',
      sublabel: 'Currently clocked in',
      value: liveCard.value,
      format: 'number',
      status: 'on-track',
      icon: '👥',
      accentColor: '#3b82f6',
    })
  }

  // Pad with placeholders if we ended up with nothing
  if (cards.length === 0) {
    return [
      { label: 'Total Shifts', sublabel: 'No data', value: '—', status: 'neutral', icon: '📋', accentColor: '#6d28d9' },
      { label: 'Completed', sublabel: 'No data', value: '—', status: 'neutral', icon: '✅', accentColor: '#10b981' },
      { label: 'Missed Shifts', sublabel: 'No data', value: '—', status: 'neutral', icon: '⚠️', accentColor: '#ef4444' },
      { label: 'Staff on Site', sublabel: 'No data', value: '—', status: 'neutral', icon: '👥', accentColor: '#3b82f6' },
    ]
  }

  return cards
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────
function ChartSkeleton({ title }) {
  return (
    <section className="panel chart-card chart-skeleton">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">CHART</p>
          <h3 className="panel__title">{title}</h3>
        </div>
      </header>
      <div className="panel__body chart-frame">
        <div className="chart-empty">
          <span className="chart-empty__icon" aria-hidden="true">📊</span>
          <p>No data available</p>
        </div>
      </div>
    </section>
  )
}
