const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashloanArbitrage", function () {
  let flashloanArbitrage;
  let owner;
  let addr1;
  let addr2;

  // Local test addresses (we'll deploy mock contracts)
  let mockAavePool;
  let mockUniswapRouter;
  let mockSushiRouter;

  // Test token addresses
  let mockUSDC;
  let mockWETH;
  let mockUSDT;

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockToken.deploy("Mock USDC", "USDC");
    mockWETH = await MockToken.deploy("Mock WETH", "WETH");
    mockUSDT = await MockToken.deploy("Mock USDT", "USDT");

    const MockPool = await ethers.getContractFactory("MockAavePool");
    mockAavePool = await MockPool.deploy();

    const MockRouter = await ethers.getContractFactory("MockRouter");
    mockUniswapRouter = await MockRouter.deploy();
    mockSushiRouter = await MockRouter.deploy();

    // Deploy main contract
    const FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
    flashloanArbitrage = await FlashloanArbitrage.deploy(
      mockAavePool.address,
      mockUniswapRouter.address,
      mockSushiRouter.address
    );
    await flashloanArbitrage.deployed();

    // Mint tokens to the mock routers and FlashloanArbitrage contract
    const amount = ethers.utils.parseEther("1000000");
    await mockUSDC.mint(mockUniswapRouter.address, amount);
    await mockWETH.mint(mockUniswapRouter.address, amount);
    await mockUSDT.mint(mockUniswapRouter.address, amount);
    await mockUSDC.mint(mockSushiRouter.address, amount);
    await mockWETH.mint(mockSushiRouter.address, amount);
    await mockUSDT.mint(mockSushiRouter.address, amount);
    await mockUSDC.mint(flashloanArbitrage.address, amount);
    await mockWETH.mint(flashloanArbitrage.address, amount);
    await mockUSDT.mint(flashloanArbitrage.address, amount);

    // Approve tokens for the flash loan arbitrage contract
    await mockUSDC.connect(owner).approve(flashloanArbitrage.address, ethers.constants.MaxUint256);
    await mockWETH.connect(owner).approve(flashloanArbitrage.address, ethers.constants.MaxUint256);
    await mockUSDT.connect(owner).approve(flashloanArbitrage.address, ethers.constants.MaxUint256);

    // Approve tokens for routers in the FlashloanArbitrage contract
    await flashloanArbitrage.approveTokens([mockUSDC.address, mockWETH.address, mockUSDT.address]);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashloanArbitrage.owner()).to.equal(owner.address);
    });

    it("Should set the correct contract addresses", async function () {
      expect(await flashloanArbitrage.aavePool()).to.equal(mockAavePool.address);
      expect(await flashloanArbitrage.uniswapRouter()).to.equal(mockUniswapRouter.address);
      expect(await flashloanArbitrage.sushiswapRouter()).to.equal(mockSushiRouter.address);
    });
  });

  describe("Arbitrage Execution", function () {
    it("Should only allow owner to execute arbitrage", async function () {
      const amount = ethers.utils.parseEther("1000");
      const path1 = [mockUSDC.address, mockWETH.address, mockUSDT.address];
      const path2 = [mockUSDT.address, mockWETH.address, mockUSDC.address];

      await expect(
        flashloanArbitrage.connect(addr1).executeArbitrage(
          mockUSDC.address,
          amount,
          path1,
          path2
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should emit ArbitrageExecuted event", async function () {
      const amount = ethers.utils.parseEther("1000");
      const path1 = [mockUSDC.address, mockWETH.address, mockUSDT.address];
      const path2 = [mockUSDT.address, mockWETH.address, mockUSDC.address];

      await expect(
        flashloanArbitrage.executeArbitrage(
          mockUSDC.address,
          amount,
          path1,
          path2
        )
      ).to.emit(flashloanArbitrage, "ArbitrageExecuted")
        .withArgs(mockUSDC.address, amount, ethers.BigNumber.from(0));
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