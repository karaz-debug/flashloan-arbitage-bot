# TODO: Implement arbitrage bot 

from web3 import Web3
from eth_account import Account
import json
import time
import os
from dotenv import load_dotenv
from web3.middleware import geth_poa_middleware


#    Python Bot:
#    ↓ Monitors prices on Uniswap and SushiSwap
#    ↓ Finds price difference > 0.5%
#    ↓ Calls smart contract
   
#    Smart Contract:
#    ↓ Borrows USDC from Aave
#    ↓ Swaps on Uniswap
#    ↓ Swaps on SushiSwap
#    ↓ Repays flash loan
#    ↓ Keeps profit


# Load environment variables
load_dotenv()

# Connect to Polygon network
w3 = Web3(Web3.HTTPProvider(os.getenv('POLYGON_RPC_URL')))
w3.middleware_onion.inject(geth_poa_middleware, layer=0)

# Load contract ABI
with open('artifacts/contracts/FlashloanArbitrage.sol/FlashloanArbitrage.json', 'r') as f:
    contract_json = json.load(f)
    contract_abi = contract_json['abi']

# Contract address (to be set after deployment)
CONTRACT_ADDRESS = os.getenv('FLASHLOAN_CONTRACT_ADDRESS')
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)

# Token addresses
USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"  # Polygon USDC
WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"  # Polygon WETH
USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"  # Polygon USDT

# DEX Router addresses
UNISWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"  # Polygon Uniswap
SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"  # Polygon SushiSwap

def get_token_price(router_address, token_in, token_out, amount_in):
    """Get token price from DEX"""
    router = w3.eth.contract(address=router_address, abi=contract_abi)
    path = [token_in, token_out]
    amounts = router.functions.getAmountsOut(amount_in, path).call()
    return amounts[1]

def calculate_profit(amount, price1, price2):
    """Calculate potential profit"""
    return price2 - price1

def execute_arbitrage(amount, path1, path2):
    """Execute arbitrage trade"""
    try:
        # Get the owner's account
        account = Account.from_key(os.getenv('PRIVATE_KEY'))
        
        # Build the transaction
        tx = contract.functions.executeArbitrage(
            USDC_ADDRESS,  # Token to borrow
            amount,        # Amount to borrow
            path1,         # First swap path
            path2          # Second swap path
        ).build_transaction({
            'from': account.address,
            'gas': 500000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(account.address),
        })

        # Sign and send the transaction
        signed_tx = w3.eth.account.sign_transaction(tx, os.getenv('PRIVATE_KEY'))
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"Arbitrage executed! Transaction hash: {receipt['transactionHash'].hex()}")
        return True
    except Exception as e:
        print(f"Error executing arbitrage: {str(e)}")
        return False

def monitor_prices():
    """Monitor prices and execute arbitrage when profitable"""
    print("Starting price monitoring...")
    
    while True:
        try:
            # Amount to check (in wei)
            amount = Web3.to_wei(1000, 'ether')  # 1000 USDC
            
            # Get prices from different DEXes
            uniswap_price = get_token_price(UNISWAP_ROUTER, USDC_ADDRESS, WETH_ADDRESS, amount)
            sushiswap_price = get_token_price(SUSHISWAP_ROUTER, USDC_ADDRESS, WETH_ADDRESS, amount)
            
            # Calculate potential profit
            profit = calculate_profit(amount, uniswap_price, sushiswap_price)
            
            # If profit is significant (e.g., > 0.5%)
            if profit > amount * 0.005:
                print(f"Arbitrage opportunity found! Potential profit: {Web3.from_wei(profit, 'ether')} ETH")
                
                # Define swap paths
                path1 = [USDC_ADDRESS, WETH_ADDRESS, USDT_ADDRESS]  # USDC -> WETH -> USDT
                path2 = [USDT_ADDRESS, WETH_ADDRESS, USDC_ADDRESS]  # USDT -> WETH -> USDC
                
                # Execute arbitrage
                if execute_arbitrage(amount, path1, path2):
                    print("Arbitrage executed successfully!")
                else:
                    print("Failed to execute arbitrage")
            
            # Wait before next check
            time.sleep(1)
            
        except Exception as e:
            print(f"Error in price monitoring: {str(e)}")
            time.sleep(5)

if __name__ == "__main__":
    monitor_prices() 