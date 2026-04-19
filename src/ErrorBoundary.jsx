import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('GitTrace crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0A0E17',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '24px'
        }}>
          <div style={{ fontSize: '32px' }}>⚠</div>
          <div style={{
            color: '#F9FAFB',
            fontSize: '18px',
            fontWeight: 600
          }}>
            GitTrace crashed
          </div>
          <div style={{
            color: '#9CA3AF',
            fontSize: '13px',
            maxWidth: '480px',
            textAlign: 'center',
            lineHeight: 1.6
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <div style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px',
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#F87171',
            maxWidth: '600px',
            width: '100%',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {this.state.error?.stack || 'No stack trace available'}
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px'
          }}>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
              }}
              style={{
                background: '#DC2626',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Clear storage and reload
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                background: '#1E293B',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                color: '#D1D5DB',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
