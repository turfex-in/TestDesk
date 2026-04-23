import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Something went wrong' }
  }

  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
        <div className="card p-10 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-danger/20 text-danger flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} />
          </div>
          <h2 className="text-h2 mb-2">Something broke</h2>
          <p className="text-body-md text-ink-muted mb-5">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-md btn-primary"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
