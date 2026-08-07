import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDashboard } from '../api/reportApi.js'
import DynamicChart from '../components/charts/DynamicChart.jsx'
import ErrorMessage from '../components/common/ErrorMessage.jsx'

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

const ICON_PATHS = {
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  alert: 'M12 9v4m0 4h.01M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z',
  building: 'M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M8 7h5M8 11h5M8 15h5M17 9h3v12',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  shifts: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3h-1m0-12a4 4 0 0 1 0 7',
}

function Icon({ name, size = 20 }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d={ICON_PATHS[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function formatMetric(value, format = 'number') {
  const numeric = Number(value ?? 0)
  if (format === 'percentage') return `${numeric.toFixed(1)}%`
  if (format === 'hours') return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`
  return numeric.toLocaleString()
}

function formatShortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function MetricCard({ accent, format, icon, inverse = false, label, note, trend, value }) {
  const numericTrend = Number(trend ?? 0)
  const favorable = inverse ? numericTrend <= 0 : numericTrend >= 0

  return (
    <article className="metric-card" style={{ '--metric-accent': accent }}>
      <div className="metric-card__top">
        <span className="metric-card__icon"><Icon name={icon} /></span>
        <span className={`metric-card__trend ${favorable ? 'metric-card__trend--good' : 'metric-card__trend--bad'}`}>
          {numericTrend > 0 ? '+' : ''}{numericTrend.toFixed(1)}%
        </span>
      </div>
      <p className="metric-card__value">{formatMetric(value, format)}</p>
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__note">{note}</p>
    </article>
  )
}

function SectionHeading({ eyebrow, title, description, trailing }) {
  return (
    <header className="dashboard-heading">
      <div>
        <p className="dashboard-heading__eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="dashboard-heading__description">{description}</p> : null}
      </div>
      {trailing}
    </header>
  )
}

function DashboardLoading() {
  return (
    <div className="dashboard-v2 dashboard-v2--loading" aria-label="Loading live dashboard">
      <div className="dashboard-shimmer dashboard-shimmer--hero" />
      <div className="dashboard-shimmer-grid">
        {Array.from({ length: 6 }, (_, index) => <div className="dashboard-shimmer" key={index} />)}
      </div>
      <div className="dashboard-shimmer-grid dashboard-shimmer-grid--charts">
        <div className="dashboard-shimmer dashboard-shimmer--chart" />
        <div className="dashboard-shimmer dashboard-shimmer--chart" />
      </div>
    </div>
  )
}

function EmployeeTable({ rows }) {
  if (!rows.length) return <EmptyPanel message="No employee shifts in this period." />

  return (
    <section className="dashboard-table-card">
      <div className="dashboard-table-card__scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee</th>
              <th>Shifts</th>
              <th>Completed</th>
              <th>Missed</th>
              <th>Rostered</th>
              <th>Actual</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.employee ?? index}>
                <td><span className="employee-rank">{index + 1}</span></td>
                <td>
                  <div className="employee-cell">
                    <span className="employee-cell__avatar">{String(row.employee ?? 'Unknown').slice(0, 2).toUpperCase()}</span>
                    <strong>{row.employee ?? 'Unknown'}</strong>
                  </div>
                </td>
                <td>{row.shift_count}</td>
                <td><span className="value-pill value-pill--green">{row.completed_count}</span></td>
                <td><span className={`value-pill ${row.missed_count ? 'value-pill--red' : 'value-pill--muted'}`}>{row.missed_count}</span></td>
                <td>{formatMetric(row.rostered_hours, 'hours')}</td>
                <td>{formatMetric(row.actual_hours, 'hours')}</td>
                <td>
                  <div className="completion-cell">
                    <span>{Number(row.completion_rate ?? 0).toFixed(0)}%</span>
                    <span className="completion-bar"><span style={{ width: `${Math.min(Number(row.completion_rate ?? 0), 100)}%` }} /></span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LiveRoster({ rows }) {
  return (
    <section className="live-roster-card">
      <div className="live-roster-card__header">
        <div>
          <p className="dashboard-heading__eyebrow">LIVE NOW</p>
          <h3>Currently clocked in</h3>
        </div>
        <span className="live-count"><span />{rows.length} active</span>
      </div>
      {rows.length ? (
        <div className="live-roster-list">
          {rows.map((row) => (
            <div className="live-roster-row" key={row.shift_id}>
              <span className="employee-cell__avatar employee-cell__avatar--live">{String(row.employee ?? 'Unknown').slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{row.employee ?? 'Unknown'}</strong>
                <p>{row.site ?? 'Unknown site'}</p>
              </div>
              <span className="live-roster-row__time">{row.scheduled_start}–{row.scheduled_end}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="live-roster-empty"><Icon name="clock" size={24} /><span>No one is currently clocked in.</span></div>
      )}
    </section>
  )
}

function InsightCard({ employee, risk, site }) {
  return (
    <section className="insight-card">
      <p className="dashboard-heading__eyebrow">QUICK READ</p>
      <h3>What deserves attention</h3>
      <div className="insight-list">
        <div className="insight-item">
          <span className="insight-item__icon insight-item__icon--purple"><Icon name="users" /></span>
          <div><span>Highest workload</span><strong>{employee ? `${employee.employee} · ${employee.shift_count} shifts` : 'No employee data'}</strong></div>
        </div>
        <div className="insight-item">
          <span className="insight-item__icon insight-item__icon--blue"><Icon name="building" /></span>
          <div><span>Busiest site</span><strong>{site ? `${site.site} · ${site.shift_count} shifts` : 'No site data'}</strong></div>
        </div>
        <div className="insight-item">
          <span className="insight-item__icon insight-item__icon--orange"><Icon name="alert" /></span>
          <div><span>Most operational flags</span><strong>{risk ? risk.site : 'No active risk flags'}</strong></div>
        </div>
      </div>
    </section>
  )
}

function EmptyPanel({ message }) {
  return <div className="dashboard-empty"><Icon name="activity" /><span>{message}</span></div>
}

function createCharts(snapshot) {
  if (!snapshot) return {}

  const siteComparisonHeight = Math.max(
    430,
    Math.max(snapshot.siteComparison.length, snapshot.riskBySite.length) * 34,
  )

  return {
    employeeHours: {
      data: snapshot.employeeComparison,
      description: 'Scheduled workload compared with hours represented by worked statuses for every named employee.',
      formatByKey: { actual_hours: 'hours', rostered_hours: 'hours' },
      height: Math.max(420, snapshot.employeeComparison.length * 35),
      layout: 'vertical',
      series: [
        { color: '#7c3aed', dataKey: 'rostered_hours', name: 'Rostered hours' },
        { color: '#14b8a6', dataKey: 'actual_hours', name: 'Actual hours' },
      ],
      title: 'Hours by employee',
      type: 'bar',
      xAxisKey: 'employee',
      yAxisWidth: 150,
    },
    employeeShifts: {
      data: snapshot.employeeComparison,
      description: 'All named employees compared by total, completed, and missed shifts.',
      formatByKey: { completed_count: 'number', missed_count: 'number', shift_count: 'number' },
      height: Math.max(420, snapshot.employeeComparison.length * 35),
      layout: 'vertical',
      series: [
        { color: '#7c3aed', dataKey: 'shift_count', name: 'All shifts' },
        { color: '#10b981', dataKey: 'completed_count', name: 'Completed' },
        { color: '#f43f5e', dataKey: 'missed_count', name: 'Missed' },
      ],
      title: 'Shift comparison by employee',
      type: 'bar',
      xAxisKey: 'employee',
      yAxisWidth: 150,
    },
    risk: {
      data: snapshot.riskBySite,
      description: 'Break, overlap, compliance, and visa/passport flags from live roster records.',
      height: siteComparisonHeight,
      layout: 'vertical',
      series: [
        { color: '#f59e0b', dataKey: 'break_conflicts', name: 'Break conflict' },
        { color: '#f43f5e', dataKey: 'overlap_conflicts', name: 'Overlap conflict' },
        { color: '#8b5cf6', dataKey: 'compliance_critical', name: 'Compliance' },
        { color: '#0ea5e9', dataKey: 'visa_critical', name: 'Visa / passport' },
      ],
      title: 'Operational flags by site',
      type: 'bar',
      xAxisKey: 'site',
      yAxisWidth: 145,
    },
    sites: {
      data: snapshot.siteComparison,
      description: 'Every active site compared by scheduled coverage and exceptions.',
      height: siteComparisonHeight,
      layout: 'vertical',
      series: [
        { color: '#2563eb', dataKey: 'shift_count', name: 'All shifts' },
        { color: '#10b981', dataKey: 'completed_count', name: 'Completed' },
        { color: '#f59e0b', dataKey: 'unfilled_count', name: 'Unfilled' },
        { color: '#f43f5e', dataKey: 'missed_count', name: 'Missed' },
      ],
      title: 'Coverage by site',
      type: 'bar',
      xAxisKey: 'site',
      yAxisWidth: 145,
    },
    status: {
      centerLabel: 'shifts',
      centerValue: snapshot.kpis.total,
      data: snapshot.statusDistribution,
      description: 'FieldServicer status distribution using the mapped StatusID values.',
      height: 340,
      series: [{ dataKey: 'count', name: 'Shifts' }],
      title: 'Roster status mix',
      type: 'pie',
      xAxisKey: 'status',
    },
    trend: {
      data: snapshot.shiftTrend,
      description: 'Daily shift volume and outcomes across the selected period.',
      height: 340,
      series: [
        { color: '#7c3aed', dataKey: 'shift_count', name: 'All shifts' },
        { color: '#10b981', dataKey: 'completed_count', name: 'Completed' },
        { color: '#f59e0b', dataKey: 'unfilled_count', name: 'Unfilled' },
        { color: '#f43f5e', dataKey: 'missed_count', name: 'Missed' },
      ],
      title: 'Shift activity over time',
      type: 'line',
      xAxisKey: 'date',
    },
  }
}

export default function DashboardPage() {
  const [days, setDays] = useState(30)
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDashboard = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      setSnapshot(await fetchDashboard({ days, refresh: forceRefresh }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const charts = useMemo(() => createCharts(snapshot), [snapshot])

  if (loading && !snapshot) return <DashboardLoading />

  const kpis = snapshot?.kpis ?? {}
  const changes = kpis.changes ?? {}
  const topEmployee = snapshot?.employeeComparison?.[0]
  const topSite = snapshot?.siteComparison?.[0]
  const topRisk = snapshot?.riskBySite?.[0]
  const totalFlags = snapshot?.riskBySite?.reduce((total, row) => (
    total + row.break_conflicts + row.overlap_conflicts + row.compliance_critical + row.visa_critical
  ), 0) ?? 0

  return (
    <div className="page dashboard-v2">
      <section className="dashboard-v2__hero">
        <div className="dashboard-v2__hero-orb dashboard-v2__hero-orb--one" />
        <div className="dashboard-v2__hero-orb dashboard-v2__hero-orb--two" />
        <div className="dashboard-v2__hero-copy">
          <span className="dashboard-v2__live"><span /> Live operations intelligence</span>
          <h1>Workforce command center</h1>
          <p>One clear view of coverage, people, sites, and operational risk—powered directly by FieldServicer.</p>
          <div className="dashboard-v2__hero-meta">
            <span>{formatShortDate(snapshot?.meta?.from)} – {formatShortDate(snapshot?.meta?.to)}</span>
            <span>{kpis.active_employees ?? 0} active employees</span>
            <span>{kpis.active_sites ?? 0} active sites</span>
          </div>
        </div>
        <div className="dashboard-v2__controls">
          <div className="period-switcher" aria-label="Dashboard date range">
            {PERIODS.map((period) => (
              <button
                className={days === period.days ? 'period-switcher__button period-switcher__button--active' : 'period-switcher__button'}
                key={period.days}
                onClick={() => setDays(period.days)}
                type="button"
              >
                {period.label}
              </button>
            ))}
          </div>
          <button className="dashboard-v2__refresh" disabled={refreshing} onClick={() => loadDashboard(true)} type="button">
            <span className={refreshing ? 'spin' : ''}><Icon name="refresh" size={17} /></span>
            {refreshing ? 'Refreshing' : 'Refresh live data'}
          </button>
        </div>
      </section>

      <ErrorMessage message={error} />

      <section className="metric-grid">
        <MetricCard accent="#7c3aed" icon="shifts" label="Total shifts" note="Compared with previous period" trend={changes.total} value={kpis.total} />
        <MetricCard accent="#10b981" icon="check" label="Completed" note={`${kpis.clocked_out ?? 0} clocked-out records`} trend={changes.completed} value={kpis.completed} />
        <MetricCard accent="#2563eb" format="percentage" icon="activity" label="Fill rate" note={`${kpis.unfilled ?? 0} currently unfilled`} value={kpis.fill_rate} />
        <MetricCard accent="#06b6d4" icon="clock" label="Clocked in now" note="Live FieldServicer status" value={kpis.clocked_in} />
        <MetricCard accent="#f59e0b" icon="users" label="Rostered hours" note="Across named employees" trend={changes.rostered_hours} value={kpis.rostered_hours} format="hours" />
        <MetricCard accent="#f43f5e" icon="alert" inverse label="Unfilled shifts" note="Compared with previous period" trend={changes.unfilled} value={kpis.unfilled} />
      </section>

      <section className="dashboard-section-v2">
        <SectionHeading eyebrow="OPERATIONS" title="The pulse of your roster" description="Volume, outcomes, and live status distribution across the selected period." />
        <div className="dashboard-chart-grid dashboard-chart-grid--pulse">
          <DynamicChart chart={charts.trend} preferArea />
          <DynamicChart chart={charts.status} preferArea={false} />
        </div>
      </section>

      <section className="dashboard-section-v2">
        <SectionHeading
          eyebrow="PEOPLE"
          title="Every employee, compared"
          description="All named employees are included—no single-bar summaries or hidden performers. Unassigned shifts remain in operational totals but are excluded from employee rankings."
          trailing={<span className="section-count">{snapshot?.employeeComparison?.length ?? 0} employees</span>}
        />
        <div className="dashboard-chart-grid dashboard-chart-grid--employees">
          <DynamicChart chart={charts.employeeShifts} preferArea={false} />
          <DynamicChart chart={charts.employeeHours} preferArea={false} />
        </div>
        <EmployeeTable rows={snapshot?.employeeComparison ?? []} />
      </section>

      <section className="dashboard-section-v2">
        <SectionHeading eyebrow="LOCATIONS" title="Coverage and operational risk" description="Compare every site using real shift coverage and conflict flags from the roster API." trailing={<span className="section-count">{totalFlags} flags</span>} />
        <div className="dashboard-chart-grid dashboard-chart-grid--sites">
          <DynamicChart chart={charts.sites} preferArea={false} />
          {snapshot?.riskBySite?.length ? <DynamicChart chart={charts.risk} preferArea={false} /> : <EmptyPanel message="No operational flags in this period." />}
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <LiveRoster rows={snapshot?.liveRoster ?? []} />
        <InsightCard employee={topEmployee} risk={topRisk} site={topSite} />
      </section>
    </div>
  )
}
