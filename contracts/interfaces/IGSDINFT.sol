// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "../interfaces/IGSDIWallet.sol";

/// @title Generic Smart Debt Instrument NFTs for lending against generic assets including vaults.
/// @author Crypto Shipwright
interface IGSDINFT is IERC721Enumerable {
    /// @return chainId_ ChainID on which the contract is deployed.
    function chainId() external view returns (uint96 chainId_);

    /// @return governance_ Address which sets governance parameters.
    function governance() external view returns (address governance_);

    /// @return isFeeEnabled_ Whether the 0.3% fee is enabled.
    function isFeeEnabled() external view returns (address isFeeEnabled_);

    /// @notice Sets the treasury address to which the fee must be sent.
    /// @return treasury_ Address to receive the 0.3% fee.
    function treasury() external view returns (address treasury_);

    /// @param _id GSDI ID to view the chain ID for.
    /// @return gsdiChainId_ ChainID for the GSDI. Leftmost 12 bytes of the GSDI id.
    function gsdiChainId(uint256 _id)
        external
        view
        returns (uint8 gsdiChainId_);

    /// @notice Returns the full onchain metadata for a GSDI or GSDI Proposal. Reverts if ID is from a different chain.
    /// @param _id ID of the GSDI. First byte is the chainID of the GSDI.
    function metadata(uint256 _id)
        external
        view
        returns (
            uint256 maturity_,
            uint256 faceValue_,
            uint256 price_,
            IGSDIWallet wallet_,
            address currency_,
            address borrower_,
            bool isInProposal
        );

    /// @notice Changes the current borrower which will receive the GSDI after it is covered. Reverts if sender is not borrower.
    /// @param _borrower New address to set the borrower to.
    function transferBorrower(address _borrower) external;

    /// @notice Sets whether the fee is enabled. Only callable by governance.
    /// @param _isFeeEnabled Whether to enable the 0.3% fee.
    function setIsFeeEnabled(bool _isFeeEnabled) external;

    /// @notice Sets the governance treasury. Only callable by governance.
    /// @param _treasury New address for the treasury.
    function setTreasury(address _treasury) external;

    /// @notice Sets the governance address. Only callable by governance.
    /// @param _governance New address for governance.
    function setGovernance(address _governance) external;

    /// @notice Mints a new GSDI in proposal to IGSDINFT. Locks the IGSDIWallet by setting IGSDINFT as the wallet's executor. Only callable by the current IGSDIWallet executor.
    /// @param _maturity Timestamp when the GSDI matures and the lender may seize the wallet.
    /// @param _faceValue Amount of currency borrower must pay to cover the GSDI.
    /// @param _price Amount of currency the lender must pay the borrower to mint the GSDI.
    /// @param _wallet Wallet containing collateral backing the GSDI.
    /// @param _currency Token currency for the price and face value.
    /// @param _borrower Address which will become the wallet executor after the GSDI is covered.
    function propose(
        uint256 _maturity,
        uint256 _faceValue,
        uint256 _price,
        IGSDIWallet _wallet,
        address _currency,
        address _borrower
    ) external;

    ///@notice Cancels the GSDI proposal. Sender must be borrower. GSDI must currently be in proposal. GSDI must be on the current chain. Burns the GSDI.
    /// @param _id GSDI to cancel.
    function cancel(uint256 _id) external;

    /// @notice Sends the GSDI to sender. The IGSDIWallet must be in proposal. GSDI must be on the current chain. Transfers price in currency from sender to borrower. Removes GSDI from proposal.
    /// @notice If governance has enabled the 0.3% fee, the sender must also transfer the fee to the governance's treasury.
    /// @dev Sender must approve the contract to transfer price of currency before call.
    /// @param _id GSDI to purchase.
    function purchase(uint256 _id) external;

    /// @notice Sets the borrower for IGSDIWallet to executor. The IGSDIWallet must not be in proposal. GSDI must be on the current chain. Sender transfers face value in currency to current GSDI holder. Burns the GSDI.
    /// @dev Sender must approve the contract to transfer face value of currency before call.
    /// @param _id GSDI to cover.
    function cover(uint256 _id) external;

    /// @notice Sets the lender for IGSDIWallet to executor. The GSDI must be held by sender. GSDI must be on the current chain. Must be after maturity. Burns the GSDI.
    /// @param _id GSDI to seize.
    function seize(uint256 _id) external;
}
