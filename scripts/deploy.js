const hre = require("hardhat");

async function main() {
  // Deploy mock tokens
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
  const weth = await MockToken.deploy("Wrapped Ether", "WETH", 18);
  const usdt = await MockToken.deploy("Tether USD", "USDT", 6);

  await usdc.deployed();
  await weth.deployed();
  await usdt.deployed();

  console.log("Mock USDC deployed to:", usdc.address);
  console.log("Mock WETH deployed to:", weth.address);
  console.log("Mock USDT deployed to:", usdt.address);

  // Deploy mock Aave pool
  const MockAavePool = await hre.ethers.getContractFactory("MockAavePool");
  const aavePool = await MockAavePool.deploy();
  await aavePool.deployed();
  console.log("Mock Aave Pool deployed to:", aavePool.address);

  // Deploy mock routers
  const MockRouter = await hre.ethers.getContractFactory("MockRouter");
  const uniswapRouter = await MockRouter.deploy();
  const sushiswapRouter = await MockRouter.deploy();
  await uniswapRouter.deployed();
  await sushiswapRouter.deployed();
  console.log("Mock Uniswap Router deployed to:", uniswapRouter.address);
  console.log("Mock SushiSwap Router deployed to:", sushiswapRouter.address);

  // Deploy FlashloanArbitrage contract
  const FlashloanArbitrage = await hre.ethers.getContractFactory("FlashloanArbitrage");
  const flashloanArbitrage = await FlashloanArbitrage.deploy(
    aavePool.address,
    uniswapRouter.address,
    sushiswapRouter.address
  );
  await flashloanArbitrage.deployed();
  console.log("FlashloanArbitrage deployed to:", flashloanArbitrage.address);

  // Set exchange rates
  await uniswapRouter.setExchangeRate(usdc.address, weth.address, ethers.utils.parseUnits("0.0005", 18)); // 1 USDC = 0.0005 WETH
  await uniswapRouter.setExchangeRate(weth.address, usdt.address, ethers.utils.parseUnits("2000", 6)); // 1 WETH = 2000 USDT
  await sushiswapRouter.setExchangeRate(usdc.address, weth.address, ethers.utils.parseUnits("0.00048", 18)); // 1 USDC = 0.00048 WETH
  await sushiswapRouter.setExchangeRate(weth.address, usdt.address, ethers.utils.parseUnits("2050", 6)); // 1 WETH = 2050 USDT

  // Mint tokens to Aave pool and routers
  await usdc.mint(aavePool.address, ethers.utils.parseUnits("1000000", 6)); // 1M USDC
  await weth.mint(uniswapRouter.address, ethers.utils.parseUnits("1000", 18)); // 1000 WETH
  await usdt.mint(uniswapRouter.address, ethers.utils.parseUnits("2000000", 6)); // 2M USDT
  await weth.mint(sushiswapRouter.address, ethers.utils.parseUnits("1000", 18)); // 1000 WETH
  await usdt.mint(sushiswapRouter.address, ethers.utils.parseUnits("2000000", 6)); // 2M USDT

  // Approve tokens for routers
  await usdc.approve(uniswapRouter.address, ethers.constants.MaxUint256);
  await weth.approve(uniswapRouter.address, ethers.constants.MaxUint256);
  await usdt.approve(uniswapRouter.address, ethers.constants.MaxUint256);
  await usdc.approve(sushiswapRouter.address, ethers.constants.MaxUint256);
  await weth.approve(sushiswapRouter.address, ethers.constants.MaxUint256);
  await usdt.approve(sushiswapRouter.address, ethers.constants.MaxUint256);

  console.log("Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 