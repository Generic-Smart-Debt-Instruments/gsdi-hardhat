// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IWETH {
    function balanceOf(address owner) external view returns (uint);
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function approve(address spender, uint256 amount) external returns (bool);
}