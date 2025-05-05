const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashloanArbitrage", function () {
  let flashloanArbitrage;
  let owner;
  let addr1;
  let addr2;

  // Mumbai testnet addresses
  const AAVE_POOL = "0x1758D4e6f68166C4B2d9d0F86f7F7748b9A7F6D5";
  const UNISWAP_ROUTER = "0x8954AfA98594b838bda56FE4C12a09D7739D179b";
  const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

  // Test token addresses (Mumbai testnet)
  const USDC = "0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747";
  const WETH = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";
  const USDT = "0x3813e82e6f7098b9583FC0F33a962D02018B6803";

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy contract
    const FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
    flashloanArbitrage = await FlashloanArbitrage.deploy(
      AAVE_POOL,
      UNISWAP_ROUTER,
      SUSHISWAP_ROUTER
    );
    await flashloanArbitrage.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashloanArbitrage.owner()).to.equal(owner.address);
    });

    it("Should set the correct Aave Pool address", async function () {
      expect(await flashloanArbitrage.aavePool()).to.equal(AAVE_POOL);
    });

    it("Should set the correct Uniswap Router address", async function () {
      expect(await flashloanArbitrage.uniswapRouter()).to.equal(UNISWAP_ROUTER);
    });

    it("Should set the correct SushiSwap Router address", async function () {
      expect(await flashloanArbitrage.sushiswapRouter()).to.equal(SUSHISWAP_ROUTER);
    });
  });

  describe("Arbitrage Execution", function () {
    it("Should only allow owner to execute arbitrage", async function () {
      const amount = ethers.utils.parseEther("1000");
      const path1 = [USDC, WETH, USDT];
      const path2 = [USDT, WETH, USDC];

      await expect(
        flashloanArbitrage.connect(addr1).executeArbitrage(
          USDC,
          amount,
          path1,
          path2
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should emit ArbitrageExecuted event", async function () {
      const amount = ethers.utils.parseEther("1000");
      const path1 = [USDC, WETH, USDT];
      const path2 = [USDT, WETH, USDC];

      await expect(
        flashloanArbitrage.executeArbitrage(
          USDC,
          amount,
          path1,
          path2
        )
      ).to.emit(flashloanArbitrage, "ArbitrageExecuted")
        .withArgs(USDC, amount, ethers.BigNumber.from(0)); // Initial profit will be 0
    });
  });

  describe("Address Updates", function () {
    it("Should only allow owner to update addresses", async function () {
      const newAavePool = addr1.address;
      const newUniswapRouter = addr2.address;
      const newSushiRouter = owner.address;

      await expect(
        flashloanArbitrage.connect(addr1).updateAddresses(
          newAavePool,
          newUniswapRouter,
          newSushiRouter
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should update addresses correctly", async function () {
      const newAavePool = addr1.address;
      const newUniswapRouter = addr2.address;
      const newSushiRouter = owner.address;

      await flashloanArbitrage.updateAddresses(
        newAavePool,
        newUniswapRouter,
        newSushiRouter
      );

      expect(await flashloanArbitrage.aavePool()).to.equal(newAavePool);
      expect(await flashloanArbitrage.uniswapRouter()).to.equal(newUniswapRouter);
      expect(await flashloanArbitrage.sushiswapRouter()).to.equal(newSushiRouter);
    });
  });
}); 