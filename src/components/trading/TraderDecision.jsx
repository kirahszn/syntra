import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { API_URL } from '../../utils/api'
import { Brain, Zap, ArrowRight, Clock, Play, Square } from 'lucide-react'

export default function TraderDecision({ isMobile = false }) {
  const { state, dispatch } = useApp()
  const [showDetails, setShowDetails] = useState(false)
  const [isAutoTrading, setIsAutoTrading] = useState(false)
  const [autoStatus, setAutoStatus] = useState('Idle')
  const [currentDecision, setCurrentDecision] = useState(null)

  // Check auto-trade status and get decisions
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/status`)
        const data = await response.json()
        if (data.success) {
          setIsAutoTrading(data.isAutoTrading || false)
          setAutoStatus(data.isAutoTrading ? '🟢 Running' : '⚪ Idle')
        }
      } catch (error) {
        console.error('Failed to check status:', error)
      }
    }

    const getDecision = async () => {
      try {
        const response = await fetch(`${API_URL}/api/decision`)
        const data = await response.json()
        if (data.success && data.decision) {
          setCurrentDecision(data.decision)
          // Update AppContext with the decision
          dispatch({
            type: 'UPDATE_TRADE',
            payload: {
              currentTrade: {
                decision: data.decision.decision,
                conviction: data.decision.conviction,
                price: data.decision.price
              }
            }
          })
        }
      } catch (error) {
        console.error('Failed to get decision:', error)
      }
    }
    
    checkStatus()
    getDecision()
    
    const statusInterval = setInterval(checkStatus, 3000)
    const decisionInterval = setInterval(getDecision, 5000)
    
    return () => {
      clearInterval(statusInterval)
      clearInterval(decisionInterval)
    }
  }, [dispatch])

  const startAutoTrade = async () => {
    try {
      const response = await fetch(`${API_URL}/api/start-auto-trade`, {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        setIsAutoTrading(true)
        setAutoStatus('🟢 Running')
      } else {
        alert(result.message || 'Failed to start auto trading')
      }
    } catch (error) {
      console.error('Start auto trade error:', error)
      alert('Failed to start auto trading. Make sure backend is running.')
    }
  }

  const stopAutoTrade = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stop-auto-trade`, {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        setIsAutoTrading(false)
        setAutoStatus('⚪ Idle')
      } else {
        alert(result.message || 'Failed to stop auto trading')
      }
    } catch (error) {
      console.error('Stop auto trade error:', error)
      alert('Failed to stop auto trading')
    }
  }

  const decision = currentDecision || state.currentTrade

  return (
    <div style={{
      padding: isMobile ? '20px' : '28px',
      borderRadius: '20px',
      background: 'rgba(20, 20, 30, 0.8)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: isMobile ? '16px' : '24px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px' }}>
          <div style={{
            width: isMobile ? '40px' : '48px',
            height: isMobile ? '40px' : '48px',
            borderRadius: isMobile ? '12px' : '14px',
            background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Brain size={isMobile ? 18 : 22} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 600 }}>
              🤖 AI Trading
            </h3>
            <p style={{ 
              fontSize: isMobile ? '11px' : '12px', 
              color: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.4)'
            }}>
              {isAutoTrading ? '🟢 Generating signals' : '⚪ Auto-trading disabled'}
            </p>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: isMobile ? '10px' : '12px',
            background: isAutoTrading ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
            color: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.3)'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.2)',
              animation: isAutoTrading ? 'pulseGlow 1s ease-in-out infinite' : 'none'
            }} />
            {autoStatus}
          </div>
          {isAutoTrading ? (
            <button
              onClick={stopAutoTrade}
              style={{
                padding: isMobile ? '6px 14px' : '8px 20px',
                borderRadius: '10px',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: 600,
                border: 'none',
                background: 'rgba(255,107,107,0.15)',
                color: '#FF6B6B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Square size={isMobile ? 14 : 16} />
              Stop
            </button>
          ) : (
            <button
              onClick={startAutoTrade}
              style={{
                padding: isMobile ? '6px 14px' : '8px 20px',
                borderRadius: '10px',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: 600,
                border: 'none',
                background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Play size={isMobile ? 14 : 16} />
              Start Auto
            </button>
          )}
        </div>
      </div>

      {/* Status Info */}
      <div style={{
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
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {isAutoTrading 
            ? '🤖 AI is generating trading signals' 
            : '⏸️ AI is paused'}
        </span>
        <span style={{ 
          color: isAutoTrading ? '#00D4AA' : 'rgba(255,255,255,0.3)',
          fontFamily: 'monospace'
        }}>
          {isAutoTrading ? '🔴 SIGNAL GENERATOR' : '⚪ IDLE'}
        </span>
      </div>

      {/* AI Decision Display */}
      {decision ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          <div style={{
            padding: isMobile ? '16px' : '20px',
            borderRadius: '14px',
            background: decision.decision === 'BUY' 
              ? 'rgba(0,212,170,0.05)' 
              : 'rgba(255,107,107,0.05)',
            border: `1px solid ${decision.decision === 'BUY' 
              ? 'rgba(0,212,170,0.1)' 
              : 'rgba(255,107,107,0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <p style={{ 
                fontSize: isMobile ? '11px' : '13px', 
                color: 'rgba(255,255,255,0.3)' 
              }}>
                AI Signal
              </p>
              <p style={{ 
                fontSize: isMobile ? '28px' : '32px', 
                fontWeight: 700, 
                letterSpacing: '-0.5px',
                color: decision.decision === 'BUY' ? '#00D4AA' : '#FF6B6B'
              }}>
                {decision.decision}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: isMobile ? '11px' : '13px', color: 'rgba(255,255,255,0.3)' }}>
                Conviction
              </p>
              <p style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: 700 }}>
                {Math.round(decision.conviction || 0)}%
              </p>
            </div>
          </div>

          {decision.price && (
            <div style={{
              padding: isMobile ? '12px' : '14px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)'
            }}>
              <p style={{ fontSize: isMobile ? '10px' : '12px', color: 'rgba(255,255,255,0.3)' }}>
                Price at signal
              </p>
              <p style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600, color: 'white' }}>
                ${decision.price.toFixed(2)}
              </p>
            </div>
          )}

          <div style={{
            padding: isMobile ? '10px' : '12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
            fontSize: isMobile ? '11px' : '12px',
            color: 'rgba(255,255,255,0.3)',
            textAlign: 'center'
          }}>
            💡 Go to <strong>"Manual Trading"</strong> tab to execute this trade from your wallet
          </div>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center',
          padding: isMobile ? '32px 0' : '40px 0',
          color: 'rgba(255,255,255,0.2)'
        }}>
          <Brain size={isMobile ? 32 : 40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p style={{ fontSize: isMobile ? '14px' : '15px', color: 'rgba(255,255,255,0.4)' }}>
            Waiting for AI signals...
          </p>
          <p style={{ fontSize: isMobile ? '12px' : '13px', marginTop: '6px', color: 'rgba(255,255,255,0.2)' }}>
            Click "Start Auto" to begin AI signal generation
          </p>
        </div>
      )}
    </div>
  )
}