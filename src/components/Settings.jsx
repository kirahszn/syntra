// src/components/Settings.jsx
import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { API_URL } from '../utils/api'
import { Shield, AlertTriangle, CheckCircle, Save } from 'lucide-react'

export default function Settings({ isMobile = false }) {
  const { state } = useApp()
  const [settings, setSettings] = useState({
    drawdownCap: 10,
    maxTradeAmount: 0.01,
    maxDailyTrades: 10,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    tokenAllowlist: ['BTC', 'ETH', 'SOL']
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/settings`)
        const data = await response.json()
        if (data.success) {
          setSettings(data.settings)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await response.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const toggleToken = (token) => {
    setSettings(prev => ({
      ...prev,
      tokenAllowlist: prev.tokenAllowlist.includes(token)
        ? prev.tokenAllowlist.filter(t => t !== token)
        : [...prev.tokenAllowlist, token]
    }))
  }

  if (loading) {
    return (
      <div style={{
        padding: isMobile ? '16px' : '24px',
        borderRadius: '20px',
        background: 'rgba(20,20,30,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)'
      }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '16px' : '24px',
      borderRadius: '20px',
      background: 'rgba(20,20,30,0.8)',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '10px',
          borderRadius: '12px',
          background: 'rgba(108,60,225,0.1)'
        }}>
          <Shield size={24} style={{ color: '#6C3CE1' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Risk Settings</h3>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            Guardrails for autonomous trading
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Drawdown Cap */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
            Drawdown Cap (USD)
          </label>
          <input
            type="number"
            value={settings.drawdownCap}
            onChange={(e) => setSettings(prev => ({ ...prev, drawdownCap: parseFloat(e.target.value) }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '16px'
            }}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
            Stop trading if daily loss exceeds this amount
          </p>
        </div>

        {/* Max Trade Amount */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
            Max Trade Amount (BNB)
          </label>
          <input
            type="number"
            value={settings.maxTradeAmount}
            onChange={(e) => setSettings(prev => ({ ...prev, maxTradeAmount: parseFloat(e.target.value) }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '16px'
            }}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
            Maximum BNB per trade
          </p>
        </div>

        {/* Max Daily Trades */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
            Max Daily Trades
          </label>
          <input
            type="number"
            value={settings.maxDailyTrades}
            onChange={(e) => setSettings(prev => ({ ...prev, maxDailyTrades: parseInt(e.target.value) }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '16px'
            }}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
            Maximum trades per day
          </p>
        </div>

        {/* Stop Loss */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
            Stop Loss (%)
          </label>
          <input
            type="number"
            value={settings.stopLossPercent}
            onChange={(e) => setSettings(prev => ({ ...prev, stopLossPercent: parseFloat(e.target.value) }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '16px'
            }}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
            Sell if price drops this %
          </p>
        </div>
      </div>

      {/* Token Allowlist */}
      <div style={{
        padding: '16px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '20px'
      }}>
        <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '12px' }}>
          Token Allowlist
        </label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['BTC', 'ETH', 'SOL', 'BNB'].map(token => (
            <button
              key={token}
              onClick={() => toggleToken(token)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 500,
                border: `1px solid ${settings.tokenAllowlist.includes(token) ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.1)'}`,
                background: settings.tokenAllowlist.includes(token) ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                color: settings.tokenAllowlist.includes(token) ? '#00D4AA' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {settings.tokenAllowlist.includes(token) ? `✅ ${token}` : token}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>
          Only trade these tokens
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: 600,
          border: 'none',
          background: 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        {saved ? (
          <>
            <CheckCircle size={18} />
            Settings Saved ✓
          </>
        ) : (
          <>
            <Save size={18} />
            Save Settings
          </>
        )}
      </button>

      {/* Risk Warning */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        borderRadius: '10px',
        background: 'rgba(255,107,107,0.05)',
        border: '1px solid rgba(255,107,107,0.1)',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <AlertTriangle size={14} style={{ color: '#FF6B6B' }} />
        These guardrails apply to all AI trades. Higher values = higher risk.
      </div>
    </div>
  )
}