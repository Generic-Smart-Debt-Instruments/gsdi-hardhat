// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IGSDIWallet.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title Smart wallet to hold generic assets.
/// @author jkp

contract GSDIWallet is Initializable, IGSDIWallet, ERC721Holder, ERC1155Holder {
    using SafeMath for uint256;
    using Address for address;

    address private gsdiNft_;
    address private executor_;

    modifier onlyExecutor() {
        require(msg.sender == executor_, "only executor allowed");
        _;
    }

    /// @notice Returns the gsdiNft contract.
    /// @return gsdiNft_ Address of the IGSDINFT contract managing the wallet.
    function gsdiNft() external view override returns (address) {
        return gsdiNft_;
    }

    /// @notice Returns current executor of the IGSDIWallet.
    /// @dev For GSDI dapps, guarantee that the wallet is not approved to transfer contained locked assets.
    /// @return executor_ Current executor. May be a borrower, lender, dapp, or IGSDINFT when locked.
    function executor() external view override returns (address) {
        return executor_;
    }

    /// @notice New GSDI wallets are deployed as Open Zeppelin proxies. Initialize is called on creation.
    /// @param _gsdiNft of the IGSDINFT contract managing the wallet.
    /// @param _executor Current executor. May be a borrower, lender, dapp, or IGSDINFT when locked.
    function initialize(address _gsdiNft, address _executor) public override {
        gsdiNft_ = _gsdiNft;
        executor_ = _executor;
    }

    /// @notice Sets the current executor. May only be called by executor or IGSDINFT.
    /// @param _executor New executor. IGSDINFT sets to itself to lock the wallet.
    function setExecutor(address _executor) public override onlyExecutor {
        executor_ = _executor;
    }

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
    ) public override onlyExecutor returns (bytes memory data_, bool success_) {
        (success_, data_) = _to.call{value:_value}(_data);
    }

    /// @notice Executes an arbitrary transaction. May only be called by executor. Reverts on failure.
    /// @param _to Address to call.
    /// @param _value Ether to send for call.
    /// @param _data ABI encoded with signature transaction data to send in the call
    /// @return data_ Data returned by the call.
    function safeExecute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public override onlyExecutor returns (bytes memory data_) {
        bool success;
        (success, data_) = _to.call{value:_value}(_data);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    /// @notice Tranfers arbitrary IERC20 tokens from the wallet and reverts on failure. May only be called by executor.
    /// @param _token Address of IERC20 token supporting transfer.
    /// @param _to Address to receive the tokens.
    /// @param _value Quantity of tokens to send.
    function safeTransferIERC20(
        address _token,
        address _to,
        uint256 _value
    ) public override onlyExecutor {
        safeExecute(
            _token,
            0,
            abi.encodeWithSelector(
                IERC20(_token).transfer.selector,
                _to,
                _value
            )
        );
    }

    /// @notice Transfers arbitrary IERC721 tokens from the wallet and reverts on failure. May only be called by executor.
    /// @param _token Address of IERC721 token supporting transfer.
    /// @param _to Address to receive the tokens.
    /// @param _ids IDs of tokens to send.
    function safeTransferIERC721(
        address _token,
        address _to,
        uint256[] calldata _ids
    ) public override onlyExecutor {
        for (uint256 i = 0; i < _ids.length; i++) {
            safeExecute(
                _token,
                0,
                abi.encodeWithSelector(
                    IERC721(_token).transferFrom.selector,
                    address(this),
                    _to,
                    _ids[i]
                )
            );
        }
    }

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
    ) public override onlyExecutor {
        safeExecute(
            _token,
            0,
            abi.encodeWithSelector(
                IERC1155(_token).safeBatchTransferFrom.selector,
                address(this),
                _to,
                _ids,
                _values,
                ""
            )
        );
    }
}
