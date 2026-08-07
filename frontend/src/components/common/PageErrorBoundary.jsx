import { Component } from 'react'

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Dashboard render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="page-error" role="alert">
        <span className="page-error__icon" aria-hidden="true">!</span>
        <p className="page-error__eyebrow">DASHBOARD ERROR</p>
        <h1>We couldn’t render this dashboard</h1>
        <p>The navigation is still available. Reload the dashboard to request fresh FieldServicer data.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload dashboard</button>
      </section>
    )
  }
}
