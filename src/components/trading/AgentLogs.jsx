import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../../utils/api'
import {
  Bot,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react'

const getLogStyle = type => {
  switch (type) {
    case 'buy':
    case 'buy_signal':
    case 'buy_confirmed':
      return {
        icon: TrendingUp,
        color: '#00D4AA',
        background: 'rgba(0,212,170,0.08)',
        border: 'rgba(0,212,170,0.16)'
      }

    case 'sell':
    case 'sell_confirmed':
      return {
        icon: Zap,
        color: '#F59E0B',
        background: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.16)'
      }

    case 'trade':
    case 'tx':
      return {
        icon: CheckCircle,
        color: '#00D4AA',
        background: 'rgba(0,212,170,0.08)',
        border: 'rgba(0,212,170,0.16)'
      }

    case 'risk':
    case 'error':
      return {
        icon: AlertTriangle,
        color: '#FF6B6B',
        background: 'rgba(255,107,107,0.08)',
        border: 'rgba(255,107,107,0.16)'
      }

    case 'position':
    case 'waiting':
    case 'recover':
      return {
        icon: Activity,
        color: '#6C3CE1',
        background: 'rgba(108,60,225,0.08)',
        border: 'rgba(108,60,225,0.16)'
      }

    case 'settings':
    case 'approval':
      return {
        icon: ShieldCheck,
        color: '#00D4AA',
        background: 'rgba(0,212,170,0.08)',
        border: 'rgba(0,212,170,0.16)'
      }

    case 'start':
    case 'boot':
      return {
        icon: Bot,
        color: '#00D4AA',
        background: 'rgba(0,212,170,0.08)',
        border: 'rgba(0,212,170,0.16)'
      }

    case 'stop':
      return {
        icon: Clock,
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)'
      }

    default:
      return {
        icon: Activity,
        color: 'rgba(255,255,255,0.45)',
        background: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)'
      }
  }
}

const formatTime = timestamp => {
  if (!timestamp) return ''
  try {
    return new Date(timestamp).toLocaleTimeString()
  } catch {
    return ''
  }
}

export default function AgentLogs({ isMobile = false }) {
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  const fetchLogs = async () => {
    try {
      setError(null)

      const logsRes = await fetch(`${API_URL}/api/agent-logs`)
      const logsData = await logsRes.json()

      if (logsData.success) {
        setLogs(Array.isArray(logsData.logs) ? logsData.logs : [])
      }

      const statusRes = await fetch(`${API_URL}/api/status`)
      const statusData = await statusRes.json()

      if (statusData.success) {
        setStatus(statusData)
      }

      setLastUpdated(Date.now())
    } catch (err) {
      console.error('Failed to fetch agent logs:', err)
      setError(err.message || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()

    const interval = setInterval(fetchLogs, 3000)

    return () => clearInterval(interval)
  }, [])

  const visibleLogs = useMemo(() => {
    return logs.slice(0, 20)
  }, [logs])

  const statusText = status?.isAutoTrading
    ? status?.openPosition
      ? 'Managing open position'
      : 'Scanning for next trade'
    : 'Agent paused'

  const statusColor = status?.isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.35)'

  return (
    <div
      style={{
        padding: isMobile ? '20px' : '28px',
        borderRadius: '20px',
        background: 'rgba(20, 20, 30, 0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        width: '100%'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Bot size={isMobile ? 18 : 22} style={{ color: 'white' }} />
          </div>

          <div>
            <h3 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 600 }}>
              Live Agent Activity
            </h3>
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: statusColor }}>
              {statusText}
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          style={{
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.5)',
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px'
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Status</p>
          <p style={{ fontSize: '13px', color: statusColor, fontWeight: 600 }}>
            {status?.isAutoTrading ? 'Running' : 'Paused'}
          </p>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Open Position</p>
          <p style={{ fontSize: '13px', color: status?.openPosition ? '#00D4AA' : 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {status?.openPosition ? 'Yes' : 'No'}
          </p>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Last Updated</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
            {lastUpdated ? formatTime(lastUpdated) : '...'}
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(255,107,107,0.08)',
            border: '1px solid rgba(255,107,107,0.14)',
            color: '#FF6B6B',
            fontSize: '12px',
            marginBottom: '14px'
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          maxHeight: isMobile ? '280px' : '360px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {loading ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Loading agent activity...
          </p>
        ) : visibleLogs.length > 0 ? (
          visibleLogs.map(log => {
            const style = getLogStyle(log.type)
            const Icon = style.icon

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '11px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)'
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '10px',
                    background: style.background,
                    border: `1px solid ${style.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={14} style={{ color: style.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: isMobile ? '12px' : '13px',
                      color: 'rgba(255,255,255,0.68)',
                      lineHeight: 1.4,
                      wordBreak: 'break-word'
                    }}
                  >
                    {log.message}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '4px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.25)'
                      }}
                    >
                      {formatTime(log.timestamp)}
                    </span>

                    {log.type && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: style.color,
                          background: style.background,
                          border: `1px solid ${style.border}`,
                          padding: '2px 6px',
                          borderRadius: '999px'
                        }}
                      >
                        {log.type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center'
            }}
          >
            <Bot size={32} style={{ color: 'rgba(255,255,255,0.18)', marginBottom: '10px' }} />
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
              No activity yet. Start the agent to see live background decisions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}