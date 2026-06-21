import React, { memo, useState, useEffect, useMemo } from 'react'
import { API_URL } from '../utils/api'
import { TrendingUp, Activity, DollarSign, Wallet } from 'lucide-react'

const safeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const Stats = memo(function Stats({ isMobile = false }) {
  const [agentWallet, setAgentWallet] = useState(null)
  const [tradeData, setTradeData] = useState({
    totalTrades: 0,
    winRate: 0,
    totalPnL: 0
  })
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        const walletRes = await fetch(`${API_URL}/api/agent-wallet`)
        const walletData = await walletRes.json()

        const statusRes = await fetch(`${API_URL}/api/status`)
        const statusData = await statusRes.json()

        if (!isMounted) return

        if (walletData?.success) {
          setAgentWallet(walletData)
        }

        if (statusData?.success) {
          const trades = Array.isArray(statusData.trades) ? statusData.trades : []

          setTradeData({
            totalTrades: safeNumber(statusData.totalTrades ?? trades.length, 0),
            winRate: safeNumber(statusData.winRate, 0),
            totalPnL: safeNumber(statusData.totalPnL, 0)
          })
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        if (isMounted) setHasLoadedOnce(true)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const statsData = useMemo(() => {
    const bnbBalance = safeNumber(agentWallet?.bnbBalance, 0)

    return [
      {
        label: 'Agent Balance',
        value: !hasLoadedOnce ? '...' : bnbBalance.toFixed(6),
        unit: 'BNB',
        icon: Wallet,
        gradient: 'linear-gradient(135deg, #6C3CE1, #8B5CF6)',
        subtext: agentWallet?.canAutoTrade ? '🤖 Agent wallet funded' : '⚠️ Agent key not configured'
      },
      {
        label: 'Total Trades',
        value: !hasLoadedOnce ? '...' : safeNumber(tradeData.totalTrades, 0),
        icon: Activity,
        gradient: 'linear-gradient(135deg, #6C3CE1, #8B5CF6)'
      },
      {
        label: 'Win Rate',
        value: !hasLoadedOnce ? '...' : `${safeNumber(tradeData.winRate, 0).toFixed(1)}%`,
        icon: TrendingUp,
        gradient: 'linear-gradient(135deg, #00D4AA, #34D399)'
      },
      {
        label: 'Total P&L',
        value: !hasLoadedOnce ? '...' : `${safeNumber(tradeData.totalPnL, 0).toFixed(10)} BNB`,
        icon: DollarSign,
        gradient: 'linear-gradient(135deg, #EF4444, #F87171)'
      }
    ]
  }, [agentWallet, tradeData, hasLoadedOnce])

  const getGridColumns = () => {
    if (isMobile) return 'repeat(2, 1fr)'
    return 'repeat(4, 1fr)'
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(),
        gap: isMobile ? '12px' : '20px',
        width: '100%'
      }}
    >
      {statsData.map((stat, index) => {
        const Icon = stat.icon

        return (
          <div
            key={index}
            style={{
              padding: isMobile ? '16px 18px' : '24px 28px',
              borderRadius: '20px',
              background: 'rgba(20, 20, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: isMobile ? '11px' : '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                  {stat.label}
                </p>

                <p style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, marginTop: '4px' }}>
                  {stat.value}
                </p>

                {stat.unit && (
                  <p style={{ fontSize: isMobile ? '16px' : '22px', fontWeight: 700 }}>
                    {stat.unit}
                  </p>
                )}
              </div>

              <div
                style={{
                  padding: isMobile ? '8px' : '12px',
                  borderRadius: '12px',
                  background: stat.gradient,
                  opacity: 0.12
                }}
              >
                <Icon size={isMobile ? 18 : 24} style={{ color: 'white' }} />
              </div>
            </div>

            {stat.subtext && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                {stat.subtext}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

export default Stats