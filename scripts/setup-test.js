const { ethers } = require("hardhat");

async function main() {
    // Get the contract factories
    const MockToken = await ethers.getContractFactory("MockERC20");
    const FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
    const MockRouter = await ethers.getContractFactory("MockRouter");

    // Get the deployed contract addresses
    const arbitrageAddress = "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";
    const aavePoolAddress = "0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB";
    const uniswapRouterAddress = "0x9E545E3C0baAB3E08CdfD552C960A1050f373042";
    const sushiswapRouterAddress = "0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9";
    const usdcAddress = "0x67d269191c92Caf3cD7723F116c85e6E9bf55933";
    const wethAddress = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
    const usdtAddress = "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690";

    // Get contract instances
    const arbitrageContract = await FlashloanArbitrage.attach(arbitrageAddress);
    const uniswapRouter = await MockRouter.attach(uniswapRouterAddress);
    const sushiswapRouter = await MockRouter.attach(sushiswapRouterAddress);
    const usdc = await MockToken.attach(usdcAddress);
    const weth = await MockToken.attach(wethAddress);
    const usdt = await MockToken.attach(usdtAddress);

    console.log("Setting up test environment...");

    // Set exchange rates for Uniswap (1 USDC = 0.0005 WETH, 1 WETH = 2000 USDT)
    await uniswapRouter.setExchangeRate(
        usdcAddress,
        wethAddress,
        ethers.utils.parseEther("0.0005")
    );
    await uniswapRouter.setExchangeRate(
        wethAddress,
        usdtAddress,
        ethers.utils.parseEther("2000")
    );

    // Set exchange rates for SushiSwap (1 USDT = 0.00048 WETH, 1 WETH = 2100 USDC)
    await sushiswapRouter.setExchangeRate(
        usdtAddress,
        wethAddress,
        ethers.utils.parseEther("0.00048")
    );
    await sushiswapRouter.setExchangeRate(
        wethAddress,
        usdcAddress,
        ethers.utils.parseEther("2100")
    );

    console.log("Set exchange rates for routers");

    // Mint tokens to the Aave pool (for flash loans)
    const poolMintAmount = ethers.utils.parseUnits("1000000", 6); // 1M tokens
    await usdc.mint(aavePoolAddress, poolMintAmount);
    await weth.mint(aavePoolAddress, poolMintAmount);
    await usdt.mint(aavePoolAddress, poolMintAmount);

    console.log("Minted tokens to Aave pool");

    // Mint tokens to the routers (for liquidity)
    const routerMintAmount = ethers.utils.parseUnits("1000000", 6); // 1M tokens
    await usdc.mint(uniswapRouterAddress, routerMintAmount);
    await weth.mint(uniswapRouterAddress, routerMintAmount);
    await usdt.mint(uniswapRouterAddress, routerMintAmount);
    await usdc.mint(sushiswapRouterAddress, routerMintAmount);
    await weth.mint(sushiswapRouterAddress, routerMintAmount);
    await usdt.mint(sushiswapRouterAddress, routerMintAmount);

    console.log("Minted tokens to routers");

    // Approve tokens for the routers
    const tokens = [usdcAddress, wethAddress, usdtAddress];
    await arbitrageContract.approveTokens(tokens);

    console.log("Approved tokens for routers");
    console.log("Setup complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 