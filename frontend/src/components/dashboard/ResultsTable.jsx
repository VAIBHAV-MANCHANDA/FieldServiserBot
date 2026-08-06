import { formatValue } from '../../utils/chartHelpers.js'

export default function ResultsTable({
  columns = [],
  emptyState = 'No records found.',
  rows = [],
  subtitle,
  title = 'Results',
}) {
  const visibleRows = rows.slice(0, 100)

  return (
    <section className="panel results-table">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Table</p>
          <h3 className="panel__title">{title}</h3>
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
      </header>

      <div className="panel__body results-table__body">
        {visibleRows.length === 0 ? (
          <div className="empty-state">{emptyState}</div>
        ) : (
          <div className="results-table__scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={row.id ?? rowIndex}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {formatValue(row[column.key], column.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
