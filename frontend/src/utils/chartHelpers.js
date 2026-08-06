export function formatValue(value, format = 'number') {
  if (value === null || value === undefined || value === '') return '-'

  // Plain text — return as-is (used for top-performer name cards)
  if (format === 'text') return String(value)

  const numericValue = Number(value)

  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      currency: 'USD',
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(Number.isFinite(numericValue) ? numericValue : 0)
  }

  if (format === 'percentage') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number.isFinite(numericValue) ? numericValue : 0)}%`
  }

  if (format === 'hours') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number.isFinite(numericValue) ? numericValue : 0)}h`
  }

  if (format === 'minutes') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number.isFinite(numericValue) ? numericValue : 0)}m`
  }

  if (format === 'decimal') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number.isFinite(numericValue) ? numericValue : 0)
  }

  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat('en-US').format(numericValue)
    : String(value)
}

export function formatTime(timestamp) {
  if (!timestamp) return ''

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return ''
  }
}
