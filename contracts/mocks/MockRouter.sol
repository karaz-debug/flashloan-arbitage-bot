// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRouter {
    // Simulated exchange rates (1 token = X other tokens)
    mapping(address => mapping(address => uint256)) public exchangeRates;

    constructor() {
        // Initialize with some default exchange rates
        // These will be overridden by the setup script
    }

    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
    }

    // Mock implementation of swap functions
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(deadline >= block.timestamp, "Expired");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        // Calculate amounts based on exchange rates
        for (uint i = 1; i < path.length; i++) {
            uint256 rate = exchangeRates[path[i-1]][path[i]];
            require(rate > 0, "Exchange rate not set");
            amounts[i] = (amounts[i-1] * rate) / 1e18;
            require(amounts[i] >= amountOutMin, "Insufficient output amount");
        }

        // Transfer tokens
        require(
            IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]),
            "Transfer of input token failed"
        );

        require(
            IERC20(path[path.length - 1]).transfer(to, amounts[path.length - 1]),
            "Transfer of output token failed"
        );

        return amounts;
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;

        // Calculate amounts through the path in reverse
        for (uint256 i = path.length - 1; i > 0; i--) {
            uint256 rate = exchangeRates[path[i-1]][path[i]];
            if (rate == 0) rate = 1e18; // Default 1:1 if rate not set
            amounts[i-1] = (amounts[i] * 1e18) / rate;
        }

        require(amounts[0] <= amountInMax, "Excessive input amount");

        // Transfer tokens
        IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]);
        IERC20(path[path.length - 1]).transfer(to, amountOut);

        return amounts;
    }
} 