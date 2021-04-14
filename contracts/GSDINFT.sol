// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "./interfaces/IGSDIWallet.sol";
import "./interfaces/IGSDINFT.sol";

/// @title Generic Smart Debt Instrument NFTs for lending against generic assets including vaults.
/// @author Crypto Shipwright
contract GSDINFT is IGSDINFT, ERC721Enumerable {
  using Address for address;
  using Counters for Counters.Counter;
  using BytesLib for bytes;

  Counters.Counter private _tokenIdTracker;

  /// @notice ChainID on which the contract is deployed
  uint96 public override immutable chainId;
  /// @notice  Whether the 0.3% fee is enabled
  bool public override isFeeEnabled;
  /// @notice Address which sets governance parameters
  address public override governance;
  /// @notice Treasury address to which the fee must be sent
  address public override treasury;

  struct NFTMetadata {
    uint256 maturity;
    uint256 faceValue;
    uint256 price;
    IGSDIWallet wallet;
    address currency;
    address borrower;
    bool isInProposal;
  }

  mapping(uint256 => NFTMetadata) public override metadata;

  event Propose(uint256 indexed _id, uint256 indexed _tokenId, address indexed _borrower, address _executor);
  event Cancel(uint256 indexed _id);
  event Purchase(uint256 indexed _id, address indexed _sender, uint256 indexed _value, address _receiver);
  event Cover(uint256 indexed _id, address indexed _sender, uint256 indexed _value, address _receiver);
  event Seize(uint256 indexed _id);

  /// @param _chainId ChainID on which the contract being deployed
  constructor(uint96 _chainId) ERC721("GSDI NFT", "GSDINFT") {
    chainId = _chainId;
  }

  /// @param _id GSDI ID to view the chain ID for.
  /// @return gsdiChainId_ ChainID for the GSDI. Leftmost byte of the GSDI id.
  function gsdiChainId(uint256 _id) external pure override returns (uint96 gsdiChainId_) {
    return uint96(_id >> 240);
  }

  /// @notice Sets whether the fee is enabled. Only callable by governance.
  /// @param _isFeeEnabled Whether to enable the 0.3% fee.
  function setIsFeeEnabled(bool _isFeeEnabled) external override {
    isFeeEnabled = _isFeeEnabled;
  }

  /// @notice Sets the governance treasury. Only callable by governance.
  /// @param _treasury New address for the treasury.
  function setTreasury(address _treasury) external override onlyValidAddress(_treasury) {
    treasury = _treasury;
  }

  /// @notice Sets the governance address. Only callable by governance.
  /// @param _governance New address for governance.
  function setGovernance(address _governance) external override onlyValidAddress(_governance) {
    governance = _governance;
  }

  modifier onlyValidAddress(address _address) {
    require(_address != address(0) && _address.isContract(), "Invalid address");
    _;
  }

  modifier mustBeInProposal(uint256 _id) {
    require(metadata[_id].isInProposal, "GSDI must be in proposal");
    _;
  }

  modifier mustNotBeInProposal(uint256 _id) {
    require(!metadata[_id].isInProposal, "GSDI must not be in proposal");
    _;
  }

  function burnProposal (uint256 _id) internal {
    metadata[_id].isInProposal = false;
    _burn(_id);
    _tokenIdTracker.decrement();
  }

  /// @notice Changes the current borrower which will receive the GSDI after it is covered. Reverts if sender is not borrower.
  /// @param _receiver New address to set the borrower to.
  function transferBorrower(address _receiver) external {
    
  }

  /// @notice Changes the current borrower and calls onTokenTransfer(address,uint256,bytes) on receiver.
  /// @dev See https://github.com/ethereum/EIPs/issues/677
  /// @param _receiver New address to set the borrower to.
  function transferBorrowerAndCall(
      address _receiver,
      uint256 amount,
      bytes calldata data
  ) external {

  }

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
  ) external override returns (uint256 id_) {
    uint256 tokenId = _tokenIdTracker.current(); 
    id_ = abi.encodePacked(tokenId >> 96, chainId << 160).toUint256(0);

    metadata[id_] = NFTMetadata(_maturity, _faceValue, _price, _wallet, _currency, _borrower, true);

    // Locks the IGSDIWallet by setting IGSDINFT as the wallet's executor.
    _wallet.setExecutor(address(this));

    _mint(_borrower, id_);
    _tokenIdTracker.increment();

    emit Propose(id_, tokenId, _borrower, address(this));
  }

  ///@notice Cancels the GSDI proposal. Sender must be borrower. GSDI must currently be in proposal. GSDI must be on the current chain. Burns the GSDI.
  /// @param _id GSDI to cancel.
  function cancel(uint256 _id) external mustBeInProposal(_id) override {
    burnProposal(_id);
    
    emit Cancel(_id);
  }

  /// @notice Sends the GSDI to sender. The IGSDIWallet must be in proposal. GSDI must be on the current chain. Transfers price in currency from sender to borrower. Removes GSDI from proposal.
  /// @notice If governance has enabled the 0.3% fee, the sender must also transfer the fee to the governance's treasury.
  /// @dev Sender must approve the contract to transfer price of currency before call.
  /// @param _id GSDI to purchase.
  function purchase(uint256 _id) external mustBeInProposal(_id) override {
    uint256 price = metadata[_id].price;
    
    IERC20 token = IERC20(metadata[_id].currency);
    if (token.allowance(msg.sender, address(this)) < price) {
      token.approve(address(this), price);
    }

    bytes memory transferPayload = abi.encodeWithSignature("transferFrom(address,address,unint256)", msg.sender, metadata[_id].borrower, price);
    IGSDIWallet(metadata[_id].wallet).execute(metadata[_id].borrower, 1 ether, transferPayload);
    metadata[_id].isInProposal = false;

    emit Purchase(_id, msg.sender, price, metadata[_id].borrower);
  }

  /// @notice Sets the borrower for IGSDIWallet to executor. The IGSDIWallet must not be in proposal. GSDI must be on the current chain. Sender transfers face value in currency to current GSDI holder. Burns the GSDI.
  /// @dev Sender must approve the contract to transfer face value of currency before call.
  /// @param _id GSDI to cover.
  function cover(uint256 _id) external override mustNotBeInProposal(_id) {
    uint256 faceValue = metadata[_id].faceValue;
    
    metadata[_id].wallet.setExecutor(metadata[_id].borrower);

    IERC20 token = IERC20(metadata[_id].currency);
    if (token.allowance(msg.sender, address(this)) < faceValue) {
      token.approve(address(this), faceValue);
    }

    bytes memory transferPayload = abi.encodeWithSignature("transferFrom(address,address,unint256)", msg.sender, metadata[_id].wallet.executor(), faceValue);
    IGSDIWallet(metadata[_id].wallet).execute(metadata[_id].wallet.executor(), 1 ether, transferPayload);
    burnProposal(_id);

    emit Cover(_id, msg.sender, faceValue, metadata[_id].wallet.executor());
  }

  /// @notice Sets the lender for IGSDIWallet to executor. The GSDI must be held by sender. GSDI must be on the current chain. Must be after maturity. Burns the GSDI.
  /// @param _id GSDI to seize.
  function seize(uint256 _id) external override {
    require(metadata[_id].wallet.executor() == msg.sender, "The GSDI must be held by sender.");
    require(metadata[_id].maturity > block.timestamp, "Must be after maturity.");
    burnProposal(_id);
    
    emit Seize(_id);
  }
}
