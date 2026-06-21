import React, { createContext, useContext, useReducer, useEffect } from 'react'
import {
  initializeState,
  updateAgentSignal,
  updateReputation,
  purchaseSignal
} from '../utils/state'
import { API_URL } from '../utils/api'

const AppContext = createContext()

const loadState = () => {
  try {
    const savedState = localStorage.getItem('syntra-state')

    if (savedState) {
      const parsed = JSON.parse(savedState)

      return {
        ...initializeState(),
        ...parsed,
        agents: parsed.agents || initializeState().agents,
        marketplace: parsed.marketplace || initializeState().marketplace,
        trades: parsed.trades || [],
        currentTrade: parsed.currentTrade || null,
        backendStatus: parsed.backendStatus || null,
        agentWallet: parsed.agentWallet || null,
        tradeCount: parsed.tradeCount || 0,
        winCount: parsed.winCount || 0,
        walletConnected: parsed.walletConnected || false,
        walletAddress: parsed.walletAddress || null
      }
    }
  } catch (error) {
    console.error('Failed to load state:', error)
  }

  return initializeState()
}

const initialState = loadState()

function appReducer(state, action) {
  let newState

  switch (action.type) {
    case 'SET_WALLET':
      newState = {
        ...state,
        walletConnected: action.payload.connected,
        walletAddress: action.payload.address
      }
      break

    case 'SYNC_BACKEND_STATUS': {
      const backendStatus = action.payload || {}
      const trades = Array.isArray(backendStatus.trades) ? backendStatus.trades : []

      const latestTrade = trades.length ? trades[trades.length - 1] : null
      const wins = trades.filter(t => t.result === 'WIN').length

      newState = {
        ...state,
        backendStatus,
        trades,
        currentTrade: latestTrade,
        tradeCount: backendStatus.totalTrades ?? trades.length,
        winCount: backendStatus.wins ?? wins,
        loading: false
      }
      break
    }

    case 'SYNC_AGENT_WALLET':
      newState = {
        ...state,
        agentWallet: action.payload || null
      }
      break

    case 'UPDATE_TRADE':
      newState = {
        ...state,
        currentTrade: action.payload.currentTrade
      }
      break

    case 'UPDATE_SIGNALS': {
      const newSignals = action.payload
      let updatedState = { ...state }

      Object.entries(newSignals || {}).forEach(([agentType, signal]) => {
        updatedState = updateAgentSignal(updatedState, agentType, signal)
      })

      newState = updatedState
      break
    }

    case 'PURCHASE_SIGNAL':
      newState = purchaseSignal(state, action.payload.agent, action.payload.price)
      break

    case 'UPDATE_REPUTATION':
      newState = updateReputation(state, action.payload)
      break

    case 'SET_LOADING':
      newState = { ...state, loading: action.payload }
      break

    case 'CLEAR_HISTORY':
      newState = {
        ...initializeState(),
        agents: state.agents.map(agent => ({ ...agent, signal: null })),
        marketplace: state.marketplace.map(item => ({ ...item, purchased: false })),
        tradeCount: 0,
        winCount: 0,
        walletConnected: state.walletConnected,
        walletAddress: state.walletAddress,
        backendStatus: null,
        agentWallet: null
      }
      break

    default:
      newState = state
  }

  try {
    localStorage.setItem('syntra-state', JSON.stringify(newState))
  } catch (error) {
    console.error('Failed to save state:', error)
  }

  return newState
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    const handleWalletConnected = event => {
      const address = event.detail?.address || event.detail

      dispatch({
        type: 'SET_WALLET',
        payload: { connected: true, address }
      })
    }

    const handleWalletDisconnected = () => {
      dispatch({
        type: 'SET_WALLET',
        payload: { connected: false, address: null }
      })
    }

    window.addEventListener('wallet-connected', handleWalletConnected)
    window.addEventListener('wallet-disconnected', handleWalletDisconnected)

    return () => {
      window.removeEventListener('wallet-connected', handleWalletConnected)
      window.removeEventListener('wallet-disconnected', handleWalletDisconnected)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const syncBackend = async () => {
      try {
        const statusRes = await fetch(`${API_URL}/api/status`)
        const statusData = await statusRes.json()

        if (statusData?.success && isMounted) {
          dispatch({
            type: 'SYNC_BACKEND_STATUS',
            payload: statusData
          })
        }

        const walletRes = await fetch(`${API_URL}/api/agent-wallet`)
        const walletData = await walletRes.json()

        if (walletData?.success && isMounted) {
          dispatch({
            type: 'SYNC_AGENT_WALLET',
            payload: walletData
          })
        }
      } catch (error) {
        console.error('Failed to sync backend:', error)
      }
    }

    syncBackend()
    const interval = setInterval(syncBackend, 5000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const value = {
    state,
    dispatch,
    walletConnected: state.walletConnected
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }

  return context
}