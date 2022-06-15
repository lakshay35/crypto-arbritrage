// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./aave/FlashLoanReceiverBaseV2.sol";
import "../interfaces/v2/ILendingPoolAddressesProviderV2.sol";
import "../interfaces/v2/ILendingPoolV2.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV2Pair} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Withdrawable} from "./utils/Withdrawable.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract Arbritrageur is FlashLoanReceiverBaseV2, Withdrawable {
    using SafeMath for uint256;

    address private QuickSwapFactory =
        0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32;
    ISwapRouter private swapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

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

    function _flashLoan(address[] memory assets, uint256[] memory amounts)
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
    function flashLoan(address[] memory assets, uint256[] memory amounts)
        external
    {
        _flashLoan(assets, amounts);
    }

    /*
     *  Flash loan 100000000000000000 wei (0.1 ether) worth of `_asset`
     */
    function flashLoan(address _asset, uint256 amount) external {
        address[] memory assets = new address[](1);
        assets[0] = _asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        _flashLoan(assets, amounts);
    }

    /// @notice Swap tokens against Uniswap V3 pool
    function swapTokensOnUniV3(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn
    ) external {
        // Approve the router to spend DAI.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        swapRouter.exactInputSingle(params);
    }

    function swapTokensOnQuickswap(
        address[] calldata path,
        uint amountIn,
        uint amountOut
    ) external {
        require(path.length >= 2, "Swap Path requires 2 tokens");

        IUniswapV2Router02 router = IUniswapV2Router02(
            0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
        );

        require(
            IERC20(path[0]).approve(
                0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff,
                amountIn
            ),
            "Approval to allow router to transfer failed"
        );

        router.swapExactTokensForTokens(
            amountIn,
            amountOut,
            path,
            address(this),
            block.timestamp
        );
    }

    function arbritrage(
        address loanAsset,
        uint256 loanAmount,
        bool uniToQuick,
        address uniTokenOut,
        uint24 uniPoolFee,
        address[] calldata path,
        uint quickAmountOut
    ) external onlyOwner {
        // Get flash loan from Aave
        this.flashLoan(loanAsset, loanAmount);

        if (uniToQuick) {
            // Buy on Uni and sell on Quick

            // Swap loanAsset for uniTokenOut
            this.swapTokensOnUniV3(
                loanAsset,
                uniTokenOut,
                uniPoolFee,
                loanAmount
            );

            // Estimate amount out from quickswap
            IUniswapV2Router02 router = IUniswapV2Router02(
                0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
            );

            uint256 inputBalance = IERC20(uniTokenOut).balanceOf(address(this));

            uint[] memory amountsOut = router.getAmountsOut(inputBalance, path);

            // Swap uniTokenOut for loanAsset
            this.swapTokensOnQuickswap(path, inputBalance, amountsOut[1]);
        } else {
            // Buy on Quick and sell on Uni

            // Swap loanAsset with
            this.swapTokensOnQuickswap(path, loanAmount, quickAmountOut);

            // Swap outcoming asset from quickswap for loan asset
            this.swapTokensOnUniV3(
                path[path.length - 1],
                loanAsset,
                uniPoolFee,
                quickAmountOut
            );
        }

        // Aave flash loan asset with interest will now be returned
        // Residual amount of loan asset is profit
    }
}
