// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAavePool.sol";
import "../interfaces/IFlashLoanSimpleReceiver.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAavePool is IAavePool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Transfer the tokens to the receiver
        IERC20(asset).transfer(receiverAddress, amount);

        // Execute the operation
        bool success = IFlashLoanSimpleReceiver(receiverAddress).executeOperation(
            asset,
            amount,
            0, // premium
            msg.sender,
            params
        );
        require(success, "Flash loan operation failed");

        // Get the tokens back
        require(
            IERC20(asset).transferFrom(receiverAddress, address(this), amount),
            "Failed to repay flash loan"
        );
    }

    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external override {
        require(assets.length == amounts.length, "Arrays length mismatch");
        
        // Transfer tokens to receiver
        for (uint i = 0; i < assets.length; i++) {
            IERC20(assets[i]).transfer(receiverAddress, amounts[i]);
            
            // Execute operation on receiver
            (bool success, bytes memory result) = receiverAddress.call(
                abi.encodeWithSignature(
                    "executeOperation(address[],uint256[],uint256[],address,bytes)",
                    assets,
                    amounts,
                    new uint256[](amounts.length), // premiums
                    msg.sender,
                    params
                )
            );
            require(success, "Flash loan failed");
            
            // Get tokens back
            require(
                IERC20(assets[i]).transferFrom(receiverAddress, address(this), amounts[i]),
                "Flash loan not repaid"
            );
        }
    }

    function FLASHLOAN_PREMIUM_TOTAL() external view override returns (uint128) {
        return 0; // Mock implementation - no premium
    }
} 