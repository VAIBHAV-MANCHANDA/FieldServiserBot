export default function ChatInput({
  disabled = false,
  helperText = 'Enter to send · Shift+Enter for newline',
  onChange,
  onSubmit,
  placeholder = 'Ask about shifts, attendance, employees, sites, or customers...',
  position = 'top', // 'top' | 'bottom'
  value = '',
}) {
  const handleSubmit = (event) => {
    event.preventDefault()
    if (!disabled) onSubmit?.(value)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit?.(value)
    }
  }

  return (
    <form
      className={`chat-input chat-input--${position}`}
      onSubmit={handleSubmit}
    >
      <div className="chat-input__row">
        <textarea
          className="chat-input__field"
          disabled={disabled}
          placeholder={placeholder}
          rows={2}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="chat-input__send"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
      <p className="chat-input__hint">{helperText}</p>
    </form>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
