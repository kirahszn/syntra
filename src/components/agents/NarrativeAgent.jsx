// src/components/agents/NarrativeAgent.jsx
import React, { useState, useEffect } from 'react'
import { API_URL } from '../../utils/api'
import { TrendingUp, TrendingDown, Sparkles, Zap } from 'lucide-react'

export default function NarrativeAgent({ isMobile = false }) {
  const [signal, setSignal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const response = await fetch(`${API_URL}/api/agent-signals`)
        const data = await response.json()
        if (data.success && data.signals?.narrative) {
          setSignal(data.signals.narrative)
        }
      } catch (error) {
        console.error('Failed to fetch narrative signal:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSignal()
    const interval = setInterval(fetchSignal, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div style={{
        padding: isMobile ? '20px' : '28px',
        borderRadius: '20px',
        background: 'rgba(20, 20, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.2)' }}>
          ⏳ Loading signal...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '20px' : '28px',
      borderRadius: '20px',
      background: 'rgba(20, 20, 30, 0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: isMobile ? '16px' : '20px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px' }}>
          <div style={{
            width: isMobile ? '40px' : '48px',
            height: isMobile ? '40px' : '48px',
            borderRadius: isMobile ? '12px' : '14px',
            background: 'linear-gradient(135deg, #00D4AA, #34D399)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '20px' : '24px',
            flexShrink: 0
          }}>
            📰
          </div>
          <div>
            <h3 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 600 }}>Narrative Agent</h3>
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: 'rgba(255,255,255,0.4)' }}>
              Market Narrative Strength
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={isMobile ? 12 : 14} style={{ color: signal ? '#00D4AA' : 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'rgba(255,255,255,0.3)' }}>
            {signal ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>

      {signal ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          <div style={{
            padding: isMobile ? '14px' : '16px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '12px' : '14px'
          }}>
            <div style={{
              padding: isMobile ? '8px' : '10px',
              borderRadius: '10px',
              background: signal.direction === 'bullish' ? 'rgba(0,212,170,0.1)' : 'rgba(255,107,107,0.1)',
              flexShrink: 0
            }}>
              {signal.direction === 'bullish' 
                ? <TrendingUp size={isMobile ? 16 : 20} style={{ color: '#00D4AA' }} />
                : <TrendingDown size={isMobile ? 16 : 20} style={{ color: '#FF6B6B' }} />
              }
            </div>
            <div>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: 'rgba(255,255,255,0.3)' }}>Direction</p>
              <p style={{ 
                fontSize: isMobile ? '14px' : '16px', 
                fontWeight: 600,
                textTransform: 'capitalize',
                color: signal.direction === 'bullish' ? '#00D4AA' : '#FF6B6B'
              }}>
                {signal.direction}
              </p>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: isMobile ? '12px' : '13px', color: 'rgba(255,255,255,0.3)' }}>Momentum</span>
              <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 500 }}>{signal.momentum || signal.confidence}%</span>
            </div>
            <div style={{
              width: '100%',
              height: isMobile ? '3px' : '4px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${signal.momentum || signal.confidence}%`,
                height: '100%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #00D4AA, #34D399)',
                transition: 'width 0.6s ease'
              }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: isMobile ? '12px' : '13px', color: 'rgba(255,255,255,0.3)' }}>Confidence</span>
              <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 500 }}>{signal.confidence}%</span>
            </div>
            <div style={{
              width: '100%',
              height: isMobile ? '3px' : '4px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${signal.confidence}%`,
                height: '100%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #6C3CE1, #00D4AA)',
                transition: 'width 0.6s ease'
              }} />
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: isMobile ? '10px' : '12px',
            color: 'rgba(255,255,255,0.3)',
            flexWrap: 'wrap',
            gap: '4px'
          }}>
            <span>Price: ${Number(signal.price || 0).toFixed(2)}</span>
            <span style={{ color: signal.change24h > 0 ? '#00D4AA' : '#FF6B6B' }}>
              24h: {signal.change24h > 0 ? '+' : ''}{Number(signal.change24h || 0).toFixed(2)}%
            </span>
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>

          {signal.description && (
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px'
            }}>
              💡 {signal.description}
            </div>
          )}
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center',
          padding: isMobile ? '24px 0' : '32px 0',
          color: 'rgba(255,255,255,0.2)'
        }}>
          <Sparkles size={isMobile ? 24 : 32} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p style={{ fontSize: isMobile ? '13px' : '14px' }}>No signal yet</p>
        </div>
      )}
    </div>
  )
}
