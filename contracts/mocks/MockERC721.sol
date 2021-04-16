
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract MockERC721 is ERC721PresetMinterPauserAutoId {
  constructor() ERC721PresetMinterPauserAutoId("MOCK", "MCK", "") {
    for (uint256 i = 0; i < 10; i ++) {
      mint(msg.sender);
    }
  }
}