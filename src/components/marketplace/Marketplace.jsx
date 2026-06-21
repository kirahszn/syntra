import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { API_URL } from '../../utils/api'
import {
  ShoppingCart,
  Star,
  Shield,
  TrendingUp,
  TrendingDown,
  Loader,
  Bot
} from 'lucide-react'

export default function Marketplace({ isMobile = false, isTablet = false }) {
  const { state, dispatch } = useApp()
  const [activating, setActivating] = useState(null)
  const [agentSignals, setAgentSignals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activationStatus, setActivationStatus] = useState({})

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch(`${API_URL}/api/agent-signals`)
        const data = await response.json()

        if (data.success) {
          setAgentSignals(data.signals)
        }
      } catch (error) {
        console.error('Failed to fetch agent signals:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()
    const interval = setInterval(fetchSignals, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleActivate = async agentType => {
    setActivating(agentType)

    setActivationStatus(prev => ({
      ...prev,
      [agentType]: {
        status: 'pending',
        message: 'Activating intelligence agent...'
      }
    }))

    setTimeout(() => {
      dispatch({
        type: 'PURCHASE_SIGNAL',
        payload: { agent: agentType, price: 0 }
      })

      setActivationStatus(prev => ({
        ...prev,
        [agentType]: {
          status: 'success',
          message: '✅ Agent activated'
        }
      }))

      setActivating(null)
    }, 600)
  }

  const getAgentData = type => {
    const data = {
      whale: {
        icon: '🐋',
        gradient: 'linear-gradient(135deg, #6C3CE1, #8B5CF6)',
        description: 'Smart Money Movement'
      },
      narrative: {
        icon: '📰',
        gradient: 'linear-gradient(135deg, #00D4AA, #34D399)',
        description: 'Market Narrative Strength'
      },
      derivatives: {
        icon: '📊',
        gradient: 'linear-gradient(135deg, #FF6B6B, #F87171)',
        description: 'Funding & Leverage'
      }
    }

    return data[type]
  }

  const getGridColumns = () => {
    if (isMobile) return '1fr'
    if (isTablet) return 'repeat(2, 1fr)'
    return 'repeat(3, 1fr)'
  }

  const activeCount = state.marketplace.filter(item => item.purchased).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '28px' }}>
      <div
        style={{
          padding: isMobile ? '16px 20px' : '28px 32px',
          borderRadius: '20px',
          background: 'rgba(20, 20, 30, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '0'
        }}
      >
        <div>
          <h2
            style={{
              fontSize: isMobile ? '18px' : '22px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <ShoppingCart size={isMobile ? 20 : 24} style={{ color: '#6C3CE1' }} />
            Intelligence Marketplace
          </h2>

          <p
            style={{
              fontSize: isMobile ? '13px' : '15px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '4px'
            }}
          >
            Activate AI signal agents for the autonomous trading engine
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: isMobile ? '6px 14px' : '8px 18px',
            borderRadius: '100px',
            background: 'rgba(0,212,170,0.1)',
            border: '1px solid rgba(0,212,170,0.15)'
          }}
        >
          <div
            style={{
              width: isMobile ? '6px' : '8px',
              height: isMobile ? '6px' : '8px',
              borderRadius: '50%',
              background: agentSignals ? '#00D4AA' : '#FF6B6B',
              animation: agentSignals ? 'pulseGlow 1.5s ease-in-out infinite' : 'none'
            }}
          />

          <span
            style={{
              fontSize: isMobile ? '11px' : '13px',
              color: agentSignals ? '#00D4AA' : '#FF6B6B'
            }}
          >
            {agentSignals ? `🔴 LIVE · ${activeCount}/3 ACTIVE` : '⏳ LOADING'}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'rgba(0,212,170,0.05)',
          border: '1px solid rgba(0,212,170,0.1)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: isMobile ? '12px' : '14px'
        }}
      >
        <Bot size={16} style={{ display: 'inline', marginRight: '8px', color: '#00D4AA' }} />
        Demo mode: agent activation is free. Trades execute from the funded Syntra agent wallet.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
          ⏳ Loading signals...
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: getGridColumns(),
            gap: isMobile ? '16px' : '24px'
          }}
        >
          {state.marketplace.map(item => {
            const agent = state.agents.find(a => a.type === item.agent)
            const agentData = getAgentData(item.agent)
            const isActivated = item.purchased
            const isActivatingAgent = activating === item.agent
            const status = activationStatus[item.agent]
            const signal = agentSignals?.[item.agent]

            return (
              <div
                key={item.agent}
                style={{
                  padding: isMobile ? '20px' : '32px',
                  borderRadius: '20px',
                  background: 'rgba(20, 20, 30, 0.6)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${
                    isActivated ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.06)'
                  }`,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s ease'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: agentData.gradient,
                    opacity: isActivated ? 1 : 0.3
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        width: isMobile ? '44px' : '56px',
                        height: isMobile ? '44px' : '56px',
                        borderRadius: isMobile ? '12px' : '16px',
                        background: agentData.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? '22px' : '28px',
                        flexShrink: 0
                      }}
                    >
                      {agentData.icon}
                    </div>

                    <div>
                      <h3
                        style={{
                          fontSize: isMobile ? '15px' : '18px',
                          fontWeight: 600,
                          textTransform: 'capitalize'
                        }}
                      >
                        {item.agent}
                      </h3>

                      <p
                        style={{
                          fontSize: isMobile ? '11px' : '13px',
                          color: 'rgba(255,255,255,0.4)'
                        }}
                      >
                        {agentData.description}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: isMobile ? '4px 10px' : '6px 14px',
                      borderRadius: '100px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <Star size={isMobile ? 12 : 14} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                    <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 600 }}>
                      {Math.round(item.trust)}
                    </span>
                  </div>
                </div>

                {signal ? (
                  <div
                    style={{
                      padding: isMobile ? '14px' : '18px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: '24px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}
                    >
                      <span style={{ fontSize: isMobile ? '11px' : '13px', color: 'rgba(255,255,255,0.3)' }}>
                        Current Signal
                      </span>

                      <span
                        style={{
                          fontSize: isMobile ? '11px' : '13px',
                          fontWeight: 500,
                          padding: '4px 14px',
                          borderRadius: '100px',
                          background:
                            signal.direction === 'bullish'
                              ? 'rgba(0,212,170,0.15)'
                              : 'rgba(255,107,107,0.15)',
                          color: signal.direction === 'bullish' ? '#00D4AA' : '#FF6B6B',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {signal.direction === 'bullish' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {signal.direction === 'bullish' ? 'Bullish' : 'Bearish'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: isMobile ? '20px' : '32px', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Confidence</p>
                        <p style={{ fontSize: '18px', fontWeight: 600 }}>{signal.confidence}%</p>
                      </div>

                      <div>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Price</p>
                        <p style={{ fontSize: '18px', fontWeight: 600 }}>${signal.price.toFixed(2)}</p>
                      </div>

                      {signal.change24h !== undefined && (
                        <div>
                          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>24h Change</p>
                          <p
                            style={{
                              fontSize: '18px',
                              fontWeight: 600,
                              color: signal.change24h > 0 ? '#00D4AA' : '#FF6B6B'
                            }}
                          >
                            {signal.change24h > 0 ? '+' : ''}
                            {signal.change24h.toFixed(2)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: isMobile ? '14px' : '18px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      marginBottom: '24px',
                      textAlign: 'center',
                      color: 'rgba(255,255,255,0.2)',
                      fontSize: '13px'
                    }}
                  >
                    ⏳ Loading signal...
                  </div>
                )}

                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>Trust Score</span>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{Math.round(item.trust)}%</span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${item.trust}%`,
                        height: '100%',
                        borderRadius: '6px',
                        background: 'linear-gradient(90deg, #6C3CE1, #00D4AA)',
                        transition: 'width 0.8s ease'
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.3)'
                    }}
                  >
                    <span>Accuracy: {Math.round(agent?.accuracy || 70)}%</span>
                    <span>Demo activation</span>
                  </div>
                </div>

                <button
                  onClick={() => handleActivate(item.agent)}
                  disabled={isActivated || isActivatingAgent}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    fontSize: '15px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isActivated || isActivatingAgent ? 'default' : 'pointer',
                    background: isActivated
                      ? 'rgba(0,212,170,0.1)'
                      : isActivatingAgent
                        ? 'rgba(255,255,255,0.05)'
                        : 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
                    color: isActivated ? '#00D4AA' : isActivatingAgent ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  {isActivated ? (
                    <>
                      <Shield size={18} />
                      Agent Activated ✓
                    </>
                  ) : isActivatingAgent ? (
                    <>
                      <Loader size={18} className="animate-spin-slow" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Bot size={18} />
                      Activate Agent
                    </>
                  )}
                </button>

                {status && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px',
                      borderRadius: '8px',
                      background:
                        status.status === 'success'
                          ? 'rgba(0,212,170,0.1)'
                          : 'rgba(255,255,255,0.05)',
                      border:
                        status.status === 'success'
                          ? '1px solid rgba(0,212,170,0.15)'
                          : '1px solid rgba(255,255,255,0.08)',
                      fontSize: '11px',
                      color: status.status === 'success' ? '#00D4AA' : 'rgba(255,255,255,0.45)'
                    }}
                  >
                    {status.message}
                  </div>
                )}

                {isActivated && !status && (
                  <div
                    style={{
                      marginTop: '12px',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: '#00D4AA'
                    }}
                  >
                    ✓ Signal integrated into intelligence pool
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}