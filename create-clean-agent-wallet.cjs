const { ethers } = require('ethers')
const fs = require('fs')

const wallet = ethers.Wallet.createRandom()

const output = `
# CLEAN AGENT WALLET - ${new Date().toISOString()}
AGENT_PRIVATE_KEY=${wallet.privateKey}
AGENT_ADDRESS=${wallet.address}
`

console.log('\nNEW CLEAN AGENT WALLET')
console.log('='.repeat(50))
console.log('Address:', wallet.address)
console.log('Private Key:', wallet.privateKey)
console.log('Seed Phrase:', wallet.mnemonic.phrase)
console.log('='.repeat(50))

fs.writeFileSync('clean-agent-wallet.txt', output)

console.log('\nSaved safe .env values to clean-agent-wallet.txt')
console.log('Copy ONLY these two lines into .env')