export function initializeState() {
  return {
    agents: [
      {
        type: 'whale',
        name: 'Whale Agent',
        price: 0,
        trust: 85,
        accuracy: 78,
        signal: null,
        icon: '🐋'
      },
      {
        type: 'narrative',
        name: 'Narrative Agent',
        price: 0,
        trust: 72,
        accuracy: 65,
        signal: null,
        icon: '📰'
      },
      {
        type: 'derivatives',
        name: 'Derivatives Agent',
        price: 0,
        trust: 68,
        accuracy: 71,
        signal: null,
        icon: '📊'
      }
    ],
    marketplace: [
      { agent: 'whale', price: 0, trust: 85, purchased: false },
      { agent: 'narrative', price: 0, trust: 72, purchased: false },
      { agent: 'derivatives', price: 0, trust: 68, purchased: false }
    ],
    trades: [],
    currentTrade: null,
    backendStatus: null,
    agentWallet: null,
    lastUpdate: null,
    lastExecution: null,
    loading: false,
    tradeCount: 0,
    winCount: 0,
    walletConnected: false,
    walletAddress: null
  }
}

export function updateAgentSignal(state, agentType, signal) {
  const updatedAgents = state.agents.map(agent =>
    agent.type === agentType ? { ...agent, signal } : agent
  )

  return {
    ...state,
    agents: updatedAgents,
    lastUpdate: Date.now()
  }
}

export function addTrade(state, trade) {
  return {
    ...state,
    trades: [...state.trades, trade],
    currentTrade: trade,
    lastExecution: Date.now()
  }
}

export function updateReputation(state, updates) {
  const updatedAgents = state.agents.map(agent => {
    const update = updates[agent.type]
    return update ? { ...agent, trust: update.trust, accuracy: update.accuracy } : agent
  })

  const updatedMarketplace = state.marketplace.map(item => {
    const update = updates[item.agent]
    return update ? { ...item, trust: update.trust } : item
  })

  return {
    ...state,
    agents: updatedAgents,
    marketplace: updatedMarketplace
  }
}

export function purchaseSignal(state, agentType, price = 0) {
  const updatedMarketplace = state.marketplace.map(item =>
    item.agent === agentType ? { ...item, purchased: true, price: 0 } : item
  )

  return {
    ...state,
    marketplace: updatedMarketplace
  }
}

export function resetState() {
  return initializeState()
}