const { ethers } = require("hardhat");

async function main() {
    // Get the contract factory
    const FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
    
    // Use the deployed contract address from our local deployment
    const contractAddress = "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";
    const arbitrageContract = await FlashloanArbitrage.attach(contractAddress);

    // Use mock token addresses from our local deployment
    const USDC = "0x67d269191c92Caf3cD7723F116c85e6E9bf55933";
    const WETH = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
    const USDT = "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690";

    // Define the arbitrage paths
    const path1 = [USDC, WETH, USDT]; // USDC -> WETH -> USDT
    const path2 = [USDT, WETH, USDC]; // USDT -> WETH -> USDC

    // Amount to borrow (in USDC, 6 decimals)
    const amount = ethers.utils.parseUnits("1000", 6); // 1000 USDC

    try {
        console.log("Executing arbitrage trade...");
        
        // Execute the arbitrage
        const tx = await arbitrageContract.executeArbitrage(
            USDC,
            amount,
            path1,
            path2
        );

        console.log("Transaction hash:", tx.hash);
        
        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        
        // Find the ArbitrageExecuted event
        const event = receipt.events.find(e => e.event === 'ArbitrageExecuted');
        
        if (event) {
            const profit = ethers.utils.formatUnits(event.args.profit, 6);
            console.log(`Arbitrage executed successfully!`);
            console.log(`Profit: ${profit} USDC`);
        }
    } catch (error) {
        console.error("Error executing arbitrage:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 