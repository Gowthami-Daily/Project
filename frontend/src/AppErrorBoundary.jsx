import { Component } from 'react'

/** Last-resort boundary so a failed module or router still shows something. */
export default class AppErrorBoundary extends Component {
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
        <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
            <h1 className="text-lg font-bold text-red-800">The app hit an error</h1>
            <p className="mt-2 text-sm text-slate-600">
              Open DevTools (F12) → Console for the full stack trace. Common causes: outdated build (try hard
              refresh Ctrl+Shift+R), or a broken import after a dependency upgrade.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              type="button"
              className="mt-4 rounded-xl bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#172554]"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
