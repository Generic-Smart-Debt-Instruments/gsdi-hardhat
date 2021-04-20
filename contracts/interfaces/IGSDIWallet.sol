// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";

/// @title Smart wallet to hold generic assets.
/// @author Crypto Shipwright
interface IGSDIWallet is
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable
{
    /// @notice Returns the gsdiNft contract.
    /// @return gsdiNft_ Address of the IGSDINFT contract managing the wallet.
    function gsdiNft() external view returns (address gsdiNft_);

    /// @notice Returns current executor of the IGSDIWallet.
    /// @dev For GSDI dapps, guarantee that the wallet is not approved to transfer contained locked assets.
    /// @return executor_ Current executor. May be a borrower, lender, dapp, or IGSDINFT when locked.
    function executor() external view returns (address executor_);

    /// @notice New GSDI wallets are deployed as Open Zeppelin proxies. Initialize is called on creation.
    /// @param _gsdiNft of the IGSDINFT contract managing the wallet.
    /// @param _executor Current executor. May be a borrower, lender, dapp, or IGSDINFT when locked.
    function initialize(address _gsdiNft, address _executor) external;

    /// @notice Sets the current executor. May only be called by executor or IGSDINFT.
    /// @param _executor New executor. IGSDINFT sets to itself to lock the wallet.
    function setExecutor(address _executor) external;

    /// @notice Executes an arbitrary transaction. May only be called by executor.
    /// @dev `execute` will not revert if the call reverts. For automatic revert, use `safeExecute`.
    /// @param _to Address to call.
    /// @param _value Ether to send for call.
    /// @param _data ABI encoded with signature transaction data to send in the call
    /// @return data_ Data returned by the call.
    /// @return success_ Whether call completed successfully.
    function execute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) external returns (bytes memory data_, bool success_);

    /// @notice Executes an arbitrary transaction. May only be called by executor. Reverts on failure.
    /// @param _to Address to call.
    /// @param _value Ether to send for call.
    /// @param _data ABI encoded with signature transaction data to send in the call
    /// @return data_ Data returned by the call.
    function safeExecute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) external returns (bytes memory data_);

    /// @notice Tranfers arbitrary IERC20 tokens from the wallet and reverts on failure. May only be called by executor.
    /// @param _token Address of IERC20 token supporting transfer.
    /// @param _to Address to receive the tokens.
    /// @param _value Quantity of tokens to send.
    function safeTransferIERC20(
        address _token,
        address _to,
        uint256 _value
    ) external;

    /// @notice Transfers arbitrary IERC721 tokens from the wallet and reverts on failure. May only be called by executor.
    /// @param _token Address of IERC721 token supporting transfer.
    /// @param _to Address to receive the tokens.
    /// @param _ids IDs of tokens to send.
    function safeTransferIERC721(
        address _token,
        address _to,
        uint256[] calldata _ids
    ) external;

    /// @notice Transfers arbitrary IERC1155 tokens from the wallet and reverts on failure. May only be called by executor.
    /// @param _token Address of IERC1155 token supporting transfer.
    /// @param _to Address to receive the tokens.
    /// @param _ids IDs of tokens to send.
    /// @param _values Number of each token to send.
    function safeTransferIERC1155(
        address _token,
        address _to,
        uint256[] calldata _ids,
        uint256[] calldata _values
    ) external;
}
