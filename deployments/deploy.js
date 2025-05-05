const hre = require("hardhat");

async function main() {
  console.log("Deploying FlashloanArbitrage contract...");

  // Mumbai testnet addresses
  const AAVE_POOL = "0x1758D4e6f68166C4B2d9d0F86f7F7748b9A7F6D5"; // Mumbai Aave Pool
  const UNISWAP_ROUTER = "0x8954AfA98594b838bda56FE4C12a09D7739D179b"; // Mumbai Uniswap
  const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"; // Mumbai SushiSwap

  // Deploy the contract
  const FlashloanArbitrage = await hre.ethers.getContractFactory("FlashloanArbitrage");
  const flashloanArbitrage = await FlashloanArbitrage.deploy(
    AAVE_POOL,
    UNISWAP_ROUTER,
    SUSHISWAP_ROUTER
  );

  await flashloanArbitrage.deployed();

  console.log("FlashloanArbitrage deployed to:", flashloanArbitrage.address);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await flashloanArbitrage.deployTransaction.wait(5);

  // Verify the contract on Polygonscan
  console.log("Verifying contract on Polygonscan...");
  try {
    await hre.run("verify:verify", {
      address: flashloanArbitrage.address,
      constructorArguments: [
        AAVE_POOL,
        UNISWAP_ROUTER,
        SUSHISWAP_ROUTER
      ],
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.log("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 