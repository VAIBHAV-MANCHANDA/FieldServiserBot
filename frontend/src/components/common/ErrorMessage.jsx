export default function ErrorMessage({
  actionLabel = 'Retry',
  message,
  onRetry,
  title = 'Something needs attention',
}) {
  if (!message) {
    return null
  }

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__copy">
        <strong className="error-banner__title">{title}</strong>
        <p className="error-banner__message">{message}</p>
      </div>

      {onRetry ? (
        <button
          type="button"
          className="chip-button chip-button--ghost"
          onClick={onRetry}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
