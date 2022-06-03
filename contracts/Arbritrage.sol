// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./aave/FlashLoanReceiverBaseV2.sol";
import "../interfaces/v2/ILendingPoolAddressesProviderV2.sol";
import "../interfaces/v2/ILendingPoolV2.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Arbritrageur is FlashLoanReceiverBaseV2, Withdrawable {
    using SafeMath for uint256;

    constructor(address _addressProvider)
        FlashLoanReceiverBaseV2(_addressProvider)
    {}

    /**
     * @dev This function must be called only be the LENDING_POOL and takes care of repaying
     * active debt positions, migrating collateral and incurring new V2 debt token debt.
     *
     * @param assets The array of flash loaned assets used to repay debts.
     * @param amounts The array of flash loaned asset amounts used to repay debts.
     * @param premiums The array of premiums incurred as additional debts.
     * @param initiator The address that initiated the flash loan, unused.
     * @param params The byte array containing, in this case, the arrays of aTokens and aTokenAmounts.
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (assets.length != amounts.length) {
            return false;
        }
        //
        // This contract now has the funds requested.
        // Your logic goes here.
        //

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.

        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwing = amounts[i].add(premiums[i]);

            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        return true;
    }

    function _flashloan(address[] memory assets, uint256[] memory amounts)
        internal
    {
        address receiverAddress = address(this);

        address onBehalfOf = address(this);
        bytes memory params = "";
        uint16 referralCode = 0;

        uint256[] memory modes = new uint256[](assets.length);

        // 0 = no debt (flash), 1 = stable, 2 = variable
        for (uint256 i = 0; i < assets.length; i++) {
            modes[i] = 0;
        }

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    /*
     *  Flash multiple assets
     */
    function flashloan(address[] memory assets, uint256[] memory amounts)
        public
        onlyOwner
    {
        _flashloan(assets, amounts);
    }

    /*
     *  Flash loan 100000000000000000 wei (0.1 ether) worth of `_asset`
     */
    function flashloan(address _asset, uint256 amount) public onlyOwner {
        address[] memory assets = new address[](1);
        assets[0] = _asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        _flashloan(assets, amounts);
    }
}

// Arbritrage opportunity identification
// Make call to Arbritrageur contract function to arbritrage across marketplace(s)
// Call Aave lending contract for a flash loan
// Arbritrage the funds received from aave
// Send back flash loan to aave
// Send back extra tokens left after arbritrage whi
