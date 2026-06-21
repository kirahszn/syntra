import React, { useEffect, useState } from 'react'
import { API_URL } from '../utils/api'
import { Bot, Copy, CheckCircle, Wallet } from 'lucide-react'

export default function WalletConnectButton({ isMobile = false }) {
  const [agentWallet, setAgentWallet] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchAgentWallet = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agent-wallet`)
        const data = await res.json()
        if (data.success) setAgentWallet(data)
      } catch (error) {
        console.error('Failed to fetch agent wallet:', error)
      }
    }

    fetchAgentWallet()
    const interval = setInterval(fetchAgentWallet, 5000)
    return () => clearInterval(interval)
  }, [])

  const address = agentWallet?.address

  const formatAddress = addr => {
    if (!addr) return 'Not configured'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        padding: isMobile ? '16px' : '24px',
        borderRadius: '20px',
        background: 'rgba(20,20,30,0.8)',
        border: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Bot size={22} style={{ color: 'white' }} />
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Autonomous Agent Wallet</h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            No personal wallet connection required
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>
          Funded demo wallet
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '14px', fontFamily: 'monospace', color: '#00D4AA' }}>
            {formatAddress(address)}
          </p>

          {address && (
            <button
              onClick={copyAddress}
              style={{
                padding: '4px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer'
              }}
            >
              {copied ? <CheckCircle size={14} style={{ color: '#00D4AA' }} /> : <Copy size={14} />}
            </button>
          )}
        </div>

        <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
          <Wallet size={13} style={{ display: 'inline', marginRight: '6px' }} />
          {Number(agentWallet?.bnbBalance || 0).toFixed(6)} BNB ·{' '}
          {Number(agentWallet?.usdtBalance || 0).toFixed(6)} USDT
        </div>
      </div>

      <div
        style={{
          marginTop: '14px',
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(0,212,170,0.05)',
          border: '1px solid rgba(0,212,170,0.1)',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.45)'
        }}
      >
        Judges can start/stop the AI agent without connecting their own wallet.
      </div>
    </div>
  )
}