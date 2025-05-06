// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/IUniswapRouter.sol";
import "./interfaces/ISushiRouter.sol";
import "./interfaces/IFlashLoanSimpleReceiver.sol";

contract FlashloanArbitrage is Ownable, IFlashLoanSimpleReceiver {
    // Contract addresses
    address public aavePool;
    address public uniswapRouter;
    address public sushiswapRouter;

    // Events
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit
    );

    constructor(
        address _aavePool,
        address _uniswapRouter,
        address _sushiswapRouter
    ) {
        aavePool = _aavePool;
        uniswapRouter = _uniswapRouter;
        sushiswapRouter = _sushiswapRouter;
    }

    /**
     * @notice Execute arbitrage between Uniswap and SushiSwap using a flash loan
     * @param token The token to borrow in the flash loan
     * @param amount The amount to borrow
     * @param path1 The path for the first swap (e.g., USDC -> WETH -> USDT)
     * @param path2 The path for the second swap (e.g., USDT -> WETH -> USDC)
     */
    function executeArbitrage(
        address token,
        uint256 amount,
        address[] calldata path1,
        address[] calldata path2
    ) external onlyOwner {
        require(path1.length >= 2, "Invalid path1");
        require(path2.length >= 2, "Invalid path2");
        require(path1[0] == token, "First token in path1 must match flash loan token");
        require(path2[path2.length - 1] == token, "Last token in path2 must match flash loan token");

        // Execute flash loan
        bytes memory params = abi.encode(path1, path2);
        IAavePool(aavePool).flashLoanSimple(
            address(this),
            token,
            amount,
            params,
            0 // referralCode
        );
    }

    /**
     * @notice Callback function for Aave flash loan
     * @param asset The address of the asset being flash-borrowed
     * @param amount The amount of the asset being flash-borrowed
     * @param premium The fee of the flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flash loan
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == aavePool, "Caller must be Aave Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode parameters
        (address[] memory path1, address[] memory path2) = abi.decode(params, (address[], address[]));

        // Approve tokens for routers
        IERC20(asset).approve(uniswapRouter, amount);
        IERC20(asset).approve(sushiswapRouter, amount);

        // Execute first swap on Uniswap
        uint256[] memory amounts1 = IUniswapRouter(uniswapRouter).swapExactTokensForTokens(
            amount,
            0, // Accept any amount of tokens
            path1,
            address(this),
            block.timestamp
        );

        // Approve intermediate token for second swap
        IERC20(path2[0]).approve(sushiswapRouter, amounts1[amounts1.length - 1]);

        // Execute second swap on SushiSwap
        uint256[] memory amounts2 = ISushiRouter(sushiswapRouter).swapExactTokensForTokens(
            amounts1[amounts1.length - 1],
            0, // Accept any amount of tokens
            path2,
            address(this),
            block.timestamp
        );

        // Calculate profit
        uint256 amountOut = amounts2[amounts2.length - 1];
        uint256 amountToRepay = amount + premium;
        require(amountOut >= amountToRepay, "Insufficient funds to repay flash loan");

        // Approve repayment
        IERC20(asset).approve(aavePool, amountToRepay);

        // Calculate and emit profit
        uint256 profit = amountOut - amountToRepay;
        emit ArbitrageExecuted(asset, amount, profit);

        return true;
    }

    /**
     * @notice Withdraw tokens from the contract
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @notice Update the addresses of the external contracts
     * @param _aavePool The new Aave Pool address
     * @param _uniswapRouter The new Uniswap Router address
     * @param _sushiswapRouter The new SushiSwap Router address
     */
    function updateAddresses(
        address _aavePool,
        address _uniswapRouter,
        address _sushiswapRouter
    ) external onlyOwner {
        aavePool = _aavePool;
        uniswapRouter = _uniswapRouter;
        sushiswapRouter = _sushiswapRouter;
    }

    /**
     * @notice Approve tokens for the routers
     * @param tokens The array of token addresses to approve
     */
    function approveTokens(address[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(uniswapRouter, type(uint256).max);
            IERC20(tokens[i]).approve(sushiswapRouter, type(uint256).max);
        }
    }
} 