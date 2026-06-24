import React, { useState, useEffect, useMemo } from 'react'
import { API_URL } from '../../utils/api'
import { CheckCircle, XCircle, Clock, Hash, Zap, Bot } from 'lucide-react'

const safeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export default function ExecutionResult({ isMobile = false }) {
  const [recordedTrades, setRecordedTrades] = useState([])
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(API_URL + '/api/status')
        const data = await response.json()
        if (data.success) {
          setStatus(data)
          setRecordedTrades(Array.isArray(data.trades) ? data.trades : [])
        }
      } catch (error) {
        console.error('Failed to fetch trades:', error)
      }
    }
    fetchTrades()
    const interval = setInterval(fetchTrades, 5000)
    return () => clearInterval(interval)
  }, [])

  const latestTrade = useMemo(() => {
    if (!recordedTrades.length) return null
    return recordedTrades[recordedTrades.length - 1]
  }, [recordedTrades])

  const isRealTx = latestTrade?.txHash?.startsWith('0x') && latestTrade?.txHash?.length === 66
  const pnl = safeNumber(latestTrade?.pnl, 0)
  const totalPnL = safeNumber(status?.totalPnL, 0)
  const result = latestTrade?.result || 'PENDING'
  const isLoss = result === 'LOSS'
  const isOpen = result === 'OPEN'

  return (
    <div style={{
      padding: isMobile ? '20px' : '28px',
      borderRadius: '20px',
      background: 'rgba(20, 20, 30, 0.8)',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: isMobile ? '16px' : '24px', flexWrap: 'wrap', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px' }}>
          <div style={{
            width: isMobile ? '40px' : '48px', height: isMobile ? '40px' : '48px',
            borderRadius: isMobile ? '12px' : '14px',
            background: 'linear-gradient(135deg, #FF6B6B, #F87171)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Zap size={isMobile ? 18 : 22} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 600 }}>Execution Result</h3>
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: isRealTx ? '#00D4AA' : 'rgba(255,255,255,0.35)' }}>
              {isRealTx ? 'REAL BSC TX' : 'Autonomous agent execution'}
            </p>
          </div>
        </div>
        <div style={{
          padding: isMobile ? '2px 10px' : '4px 14px', borderRadius: '100px',
          fontSize: isMobile ? '10px' : '12px',
          background: latestTrade ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
          color: latestTrade ? '#00D4AA' : 'rgba(255,255,255,0.3)'
        }}>
          {latestTrade ? 'Agent Executed' : 'Pending'}
        </div>
      </div>

      {latestTrade ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          <div style={{
            padding: isMobile ? '16px' : '20px', borderRadius: '14px',
            display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px',
            background: isLoss ? 'rgba(255,107,107,0.08)' : 'rgba(0,212,170,0.05)',
            border: '1px solid ' + (isLoss ? 'rgba(255,107,107,0.2)' : 'rgba(0,212,170,0.1)'),
            flexWrap: 'wrap'
          }}>
            {isLoss ? (
              <XCircle size={isMobile ? 24 : 28} style={{ color: '#FF6B6B' }} />
            ) : (
              <CheckCircle size={isMobile ? 24 : 28} style={{ color: '#00D4AA' }} />
            )}
            <div>
              <p style={{
                fontSize: isMobile ? '18px' : '20px', fontWeight: 600,
                color: isLoss ? '#FF6B6B' : '#00D4AA'
              }}>
                {result}
              </p>
              <p style={{ fontSize: isMobile ? '13px' : '14px', color: pnl >= 0 ? '#00D4AA' : '#FF6B6B' }}>
                Trade P&L: {Number(pnl || 0).toFixed(6)} BNB
              </p>
              <p style={{ fontSize: isMobile ? '12px' : '13px', color: totalPnL >= 0 ? '#00D4AA' : '#FF6B6B' }}>
                Total P&L: {Number(totalPnL || 0).toFixed(6)} BNB
              </p>
            </div>
            <div style={{
              padding: '4px 12px', borderRadius: '100px', fontSize: '10px',
              background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00D4AA'
            }}>
              <Bot size={12} style={{ display: 'inline', marginRight: '4px' }} />
              AUTO AGENT
            </div>
          </div>

          {latestTrade.txHash && (
            <div style={{
              padding: isMobile ? '12px' : '14px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Hash size={isMobile ? 12 : 14} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'rgba(255,255,255,0.3)' }}>BSC Transaction Hash</span>
              </div>
              <p style={{ fontSize: isMobile ? '10px' : '12px', fontFamily: 'monospace', color: '#00D4AA', wordBreak: 'break-all' }}>
                {latestTrade.txHash}
              </p>
              <a href={'https://bscscan.com/tx/' + latestTrade.txHash} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', color: '#6C3CE1', textDecoration: 'none' }}>
                View on BSCScan
              </a>
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '10px' : '12px',
            color: 'rgba(255,255,255,0.2)', flexWrap: 'wrap', gap: '4px'
          }}>
            <span>Executed: {latestTrade.timestamp ? new Date(latestTrade.timestamp).toLocaleTimeString() : '...'}</span>
            <span>Conviction: {Math.round(safeNumber(latestTrade.conviction, 0))}%</span>
            <span style={{ color: '#00D4AA' }}>Autonomous</span>
          </div>

          <div style={{
            padding: isMobile ? '8px' : '10px', borderRadius: '8px',
            background: 'rgba(0,212,170,0.03)', border: '1px solid rgba(0,212,170,0.06)',
            fontSize: isMobile ? '10px' : '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center'
          }}>
            {recordedTrades.length} total autonomous trades recorded
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: isMobile ? '32px 0' : '40px 0', color: 'rgba(255,255,255,0.2)' }}>
          <Clock size={isMobile ? 32 : 40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p style={{ fontSize: isMobile ? '14px' : '15px', color: 'rgba(255,255,255,0.4)' }}>Awaiting autonomous execution...</p>
          <p style={{ fontSize: isMobile ? '12px' : '13px', marginTop: '6px', color: 'rgba(255,255,255,0.2)' }}>
            Syntra will execute trades from the funded agent wallet.
          </p>
        </div>
      )}
    </div>
  )
}
