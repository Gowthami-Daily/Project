import { Component } from 'react'

/**
 * Catches render errors from lazy routes / Recharts so the PF shell (toolbar, nav) stays visible.
 */
export default class PfOutletErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          <p className="text-base font-bold">Something went wrong loading this page</p>
          <p className="mt-2 text-sm opacity-90">
            {this.state.error?.message || 'Unknown error — try refreshing or open the browser console (F12).'}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
