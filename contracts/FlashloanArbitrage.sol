// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/IUniswapRouter.sol";
import "./interfaces/ISushiRouter.sol";

contract FlashloanArbitrage is Ownable {
    // Contract addresses
    address public aavePool;
    address public uniswapRouter;
    address public sushiswapRouter;

    // Events
    event ArbitrageExecuted(
        address token,
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
     * @notice Execute flash loan arbitrage
     * @param token The token to borrow
     * @param amount The amount to borrow
     * @param path1 First swap path (e.g., token -> WETH -> token)
     * @param path2 Second swap path (e.g., token -> WETH -> token)
     */
    function executeArbitrage(
        address token,
        uint256 amount,
        address[] calldata path1,
        address[] calldata path2
    ) external onlyOwner {
        // Prepare flash loan parameters
        address[] memory assets = new address[](1);
        assets[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt, 1 = stable, 2 = variable

        // Encode the arbitrage parameters
        bytes memory params = abi.encode(path1, path2);

        // Execute flash loan
        IAavePool(aavePool).flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );
    }

    /**
     * @notice Callback function for Aave flash loan
     * @param assets The addresses of the assets being flash-borrowed
     * @param amounts The amounts of the assets being flash-borrowed
     * @param premiums The fee of each flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flash loan
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == aavePool, "Caller must be Aave Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode the arbitrage parameters
        (address[] memory path1, address[] memory path2) = abi.decode(
            params,
            (address[], address[])
        );

        // Get the borrowed token and amount
        address token = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];

        // Approve Uniswap to spend the borrowed tokens
        IERC20(token).approve(uniswapRouter, amount);

        // Execute first swap on Uniswap
        uint256[] memory amounts1 = IUniswapRouter(uniswapRouter)
            .swapExactTokensForTokens(
                amount,
                0, // Accept any amount of tokens
                path1,
                address(this),
                block.timestamp + 300 // 5 minutes deadline
            );

        // Get the amount received from first swap
        uint256 receivedAmount = amounts1[amounts1.length - 1];

        // Approve SushiSwap to spend the received tokens
        IERC20(path1[path1.length - 1]).approve(sushiswapRouter, receivedAmount);

        // Execute second swap on SushiSwap
        uint256[] memory amounts2 = ISushiRouter(sushiswapRouter)
            .swapExactTokensForTokens(
                receivedAmount,
                0, // Accept any amount of tokens
                path2,
                address(this),
                block.timestamp + 300 // 5 minutes deadline
            );

        // Get the final amount
        uint256 finalAmount = amounts2[amounts2.length - 1];

        // Calculate profit
        uint256 profit = finalAmount - amount - premium;

        // Ensure we have enough to repay the flash loan
        require(
            finalAmount >= amount + premium,
            "Insufficient amount to repay flash loan"
        );

        // Approve Aave to take the repayment
        IERC20(token).approve(aavePool, amount + premium);

        // Emit event
        emit ArbitrageExecuted(token, amount, profit);

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
     * @notice Update contract addresses
     * @param _aavePool New Aave Pool address
     * @param _uniswapRouter New Uniswap Router address
     * @param _sushiswapRouter New SushiSwap Router address
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
} 