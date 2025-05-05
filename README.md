# Flashloan Arbitrage Bot

A sophisticated arbitrage bot that utilizes flash loans from Aave to execute profitable trades across multiple DEXes on the Polygon network.

## Features

- Flash loan integration with Aave v3
- Multi-DEX arbitrage (Uniswap, SushiSwap, QuickSwap)
- Real-time price monitoring
- Automated trade execution
- Risk management and slippage protection
- Profit calculation and optimization

## Project Structure

```
flashloan-arbitrage-bot/
│
├── contracts/                     # All Solidity smart contracts
│   ├── FlashloanArbitrage.sol    # Main arbitrage contract using Aave
│   └── interfaces/               # External contract interfaces
│
├── scripts/                      # Python/Node scripts
│   ├── bot.py                    # Main Python bot
│   ├── utils.py                  # Utility functions
│   └── monitor.py                # Monitoring logic
│
├── graphql/                      # The Graph queries
├── deployments/                  # Contract deployment scripts
├── test/                         # Smart contract tests
└── config/                       # Configuration files
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

2. Create a `.env` file with your configuration:
   ```
   PRIVATE_KEY=your_private_key
   POLYGON_RPC_URL=your_polygon_rpc_url
   MUMBAI_RPC_URL=your_mumbai_rpc_url
   ```

3. Compile contracts:
   ```bash
   npm run compile
   ```

4. Run tests:
   ```bash
   npm run test
   ```

## Usage

1. Start the bot:
   ```bash
   python scripts/bot.py
   ```

2. Monitor trades:
   ```bash
   python scripts/monitor.py
   ```

## Security

- Never commit your private keys or sensitive information
- Use environment variables for configuration
- Test thoroughly on testnet before deploying to mainnet

## License

MIT 