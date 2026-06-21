import React, { useState, useEffect, useMemo } from 'react'
import { API_URL } from '../../utils/api'
import AgentLogs from './AgentLogs'
import {
  Brain,
  Play,
  Square,
  AlertTriangle,
  Wallet,
  Activity,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  ExternalLink
} from 'lucide-react'

const safeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const formatAddress = address => {
  if (!address) return 'Not configured'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatTx = hash => {
  if (!hash) return ''
  return `${hash.slice(0, 18)}...${hash.slice(-8)}`
}

export default function TraderDecision({ isMobile = false }) {
  const [status, setStatus] = useState(null)
  const [agentWallet, setAgentWallet] = useState(null)
  const [isAutoTrading, setIsAutoTrading] = useState(false)
  const [autoStatus, setAutoStatus] = useState('Idle')
  const [openPosition, setOpenPosition] = useState(null)
  const [latestTrade, setLatestTrade] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [error, setError] = useState(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch status')
      }

      setStatus(data)
      setIsAutoTrading(Boolean(data.isAutoTrading))
      setAutoStatus(data.isAutoTrading ? '🟢 Running' : '⚪ Idle')
      setOpenPosition(data.openPosition || null)

      const trades = Array.isArray(data.trades) ? data.trades : []
      setLatestTrade(trades.length ? trades[trades.length - 1] : null)
    } catch (err) {
      console.error('Failed to check status:', err)
      setError(err.message || 'Failed to check status')
    }
  }

  const fetchAgentWallet = async () => {
    try {
      const response = await fetch(`${API_URL}/api/agent-wallet`)
      const data = await response.json()

      if (data.success) {
        setAgentWallet(data)
      }
    } catch (err) {
      console.error('Failed to fetch agent wallet:', err)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchAgentWallet()

    const statusInterval = setInterval(fetchStatus, 3000)
    const walletInterval = setInterval(fetchAgentWallet, 7000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(walletInterval)
    }
  }, [])

  const startAutoTrade = async () => {
    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/start-auto-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasedAgents: [] })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || result.error || 'Failed to start autonomous trading')
      }

      await fetchStatus()
      await fetchAgentWallet()
    } catch (err) {
      console.error('Start autonomous trading error:', err)
      setError(err.message || 'Failed to start autonomous trading')
    } finally {
      setIsStarting(false)
    }
  }

  const stopAutoTrade = async () => {
    setIsStopping(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/stop-auto-trade`, {
        method: 'POST'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to stop autonomous trading')
      }

      await fetchStatus()
    } catch (err) {
      console.error('Stop autonomous trading error:', err)
      setError(err.message || 'Failed to stop autonomous trading')
    } finally {
      setIsStopping(false)
    }
  }

  const agentAddress =
    agentWallet?.address ||
    status?.agentWallet?.address ||
    null

  const canAutoTrade =
    Boolean(agentWallet?.canAutoTrade) ||
    Boolean(status?.agentWallet?.configured)

  const bnbBalance = safeNumber(agentWallet?.bnbBalance, 0)
  const usdtBalance = safeNumber(agentWallet?.usdtBalance, 0)

  const totalTrades = safeNumber(status?.totalTrades, 0)
  const winRate = safeNumber(status?.winRate, 0)
  const totalPnL = safeNumber(status?.totalPnL, 0)

  const activeStatusText = openPosition
    ? '📈 Managing open position'
    : isAutoTrading
      ? '🤖 Searching for next AI trade setup'
      : '⏸️ Agent paused'

  const isRecoveredPosition = openPosition?.entryTxHash === 'RECOVERED_FROM_WALLET'

  const estimatedPositionText = useMemo(() => {
    if (!openPosition) return null

    const entryBNB = safeNumber(openPosition.entryBNB, 0)
    const usdtAmount = safeNumber(openPosition.usdtAmount, 0)

    return {
      entryBNB,
      usdtAmount,
      conviction: safeNumber(openPosition.conviction, 0)
    }
  }, [openPosition])

  return (
    <div
      style={{
        padding: isMobile ? '20px' : '28px',
        borderRadius: '20px',
        background: 'rgba(20, 20, 30, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? '16px' : '24px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px' }}>
          <div
            style={{
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: isMobile ? '12px' : '14px',
              background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Brain size={isMobile ? 18 : 22} style={{ color: 'white' }} />
          </div>

          <div>
            <h3 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 600 }}>
              🤖 Autonomous AI Agent
            </h3>
            <p
              style={{
                fontSize: isMobile ? '11px' : '12px',
                color: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.4)'
              }}
            >
              {activeStatusText}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '100px',
              fontSize: isMobile ? '10px' : '12px',
              background: isAutoTrading ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
              color: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.3)'
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.2)',
                animation: isAutoTrading ? 'pulseGlow 1s ease-in-out infinite' : 'none'
              }}
            />
            {autoStatus}
          </div>

          {isAutoTrading ? (
            <button
              onClick={stopAutoTrade}
              disabled={isStopping}
              style={{
                padding: isMobile ? '6px 14px' : '8px 20px',
                borderRadius: '10px',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: 600,
                border: 'none',
                background: 'rgba(255,107,107,0.15)',
                color: '#FF6B6B',
                cursor: isStopping ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isStopping ? 0.6 : 1
              }}
            >
              <Square size={isMobile ? 14 : 16} />
              {isStopping ? 'Stopping...' : 'Stop'}
            </button>
          ) : (
            <button
              onClick={startAutoTrade}
              disabled={isStarting || !canAutoTrade}
              style={{
                padding: isMobile ? '6px 14px' : '8px 20px',
                borderRadius: '10px',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: 600,
                border: 'none',
                background:
                  isStarting || !canAutoTrade
                    ? 'rgba(255,255,255,0.08)'
                    : 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
                color: isStarting || !canAutoTrade ? 'rgba(255,255,255,0.3)' : 'white',
                cursor: isStarting || !canAutoTrade ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Play size={isMobile ? 14 : 16} />
              {isStarting ? 'Starting...' : 'Start Agent'}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: isMobile ? '12px' : '14px'
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {openPosition
            ? '📈 Agent is monitoring take-profit / stop-loss'
            : isAutoTrading
              ? '🤖 Agent is trading autonomously within your rules'
              : '⏸️ Agent is paused'}
        </span>

        <span
          style={{
            color: canAutoTrade ? '#00D4AA' : '#FF6B6B',
            fontFamily: 'monospace'
          }}
        >
          {canAutoTrade ? '🔴 AGENT WALLET READY' : '⚠️ AGENT WALLET NOT CONFIGURED'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Wallet size={16} style={{ color: '#00D4AA' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Agent Wallet</p>
          </div>
          <p style={{ fontSize: '14px', color: '#00D4AA', fontFamily: 'monospace' }}>
            {formatAddress(agentAddress)}
          </p>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Activity size={16} style={{ color: '#6C3CE1' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Balances</p>
          </div>
          <p style={{ fontSize: '13px', color: 'white' }}>
            {bnbBalance.toFixed(6)} BNB
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
            {usdtBalance.toFixed(6)} USDT
          </p>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={16} style={{ color: '#00D4AA' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Policy</p>
          </div>
          <p style={{ fontSize: '13px', color: 'white' }}>
            Max trade: {safeNumber(status?.riskSettings?.maxTradeAmount, 0)} BNB
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
            TP {safeNumber(status?.riskSettings?.takeProfitPercent, 0)}% / SL{' '}
            {safeNumber(status?.riskSettings?.stopLossPercent, 0)}%
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BarChart3 size={16} style={{ color: '#00D4AA' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Total Trades</p>
          </div>
          <p style={{ fontSize: '18px', color: 'white', fontWeight: 700 }}>
            {totalTrades}
          </p>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={16} style={{ color: '#00D4AA' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Win Rate</p>
          </div>
          <p style={{ fontSize: '18px', color: 'white', fontWeight: 700 }}>
            {winRate.toFixed(1)}%
          </p>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Activity size={16} style={{ color: totalPnL >= 0 ? '#00D4AA' : '#FF6B6B' }} />
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Total P&L</p>
          </div>
          <p
            style={{
              fontSize: '18px',
              color: totalPnL >= 0 ? '#00D4AA' : '#FF6B6B',
              fontWeight: 700
            }}
          >
            {totalPnL.toFixed(10)} BNB
          </p>
        </div>
      </div>

      {openPosition && estimatedPositionText && (
        <div
          style={{
            padding: isMobile ? '16px' : '20px',
            borderRadius: '14px',
            background: 'rgba(0,212,170,0.06)',
            border: '1px solid rgba(0,212,170,0.12)',
            marginBottom: '16px'
          }}
        >
          <h4 style={{ fontSize: '14px', color: '#00D4AA', marginBottom: '8px' }}>
            📈 Open Position
          </h4>

          {isRecoveredPosition && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.16)',
                color: '#F59E0B',
                fontSize: '12px',
                marginBottom: '10px'
              }}
            >
              ⚠️ Position recovered from wallet after backend restart.
            </div>
          )}

          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            Entry value: {estimatedPositionText.entryBNB.toFixed(8)} BNB
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            Holding: {estimatedPositionText.usdtAmount.toFixed(6)} USDT
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            Conviction: {Math.round(estimatedPositionText.conviction)}%
          </p>
        </div>
      )}

      {latestTrade && (
        <div
          style={{
            padding: isMobile ? '12px' : '14px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: isMobile ? '12px' : '13px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '16px'
          }}
        >
          ✅ Latest Trade: {latestTrade.action} — {latestTrade.result}
          {latestTrade.reason ? ` (${latestTrade.reason})` : ''}
          <br />

          {latestTrade.txHash && (
            <>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                Tx: {formatTx(latestTrade.txHash)}
              </span>
              <br />
              <a
                href={`https://bscscan.com/tx/${latestTrade.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: '#6C3CE1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={11} />
                View on BSCScan
              </a>
            </>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: isMobile ? '12px' : '14px',
            borderRadius: '10px',
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.15)',
            fontSize: isMobile ? '12px' : '13px',
            color: '#FF6B6B',
            marginBottom: '16px'
          }}
        >
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '8px' }} />
          {error}
        </div>
      )}

      <AgentLogs isMobile={isMobile} />
    </div>
  )
}