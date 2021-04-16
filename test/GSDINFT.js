const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { expect } = chai;
const { ethers } = require("hardhat");
const BigNumber = require("bignumber.js");

chai.use(solidity);

const usdt_address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

describe("GSDINFT", () => {
  let gsdiId, chainId;
  let treasury, executor, borrower;
  let gsdiNFT, gsdiWallet;
  let usdt;

  before(async () => {
    const accounts = await ethers.getSigners();
    treasury = accounts[1];
    executor = accounts[2];
    borrower = accounts[3];

    const network = await ethers.provider.getNetwork();
    chainId = new BigNumber(network.chainId);
    gsdiId = chainId.multipliedBy(new BigNumber(2).pow(240));
    
    const gsdiNFTFactory = await ethers.getContractFactory("GSDINFT");
    gsdiNFT = await gsdiNFTFactory.deploy(chainId.toString())
    await gsdiNFT.deployed();

    const gsdiWalletFactory = await ethers.getContractFactory("GSDIWallet");
    gsdiWallet = await gsdiWalletFactory.deploy()
    await gsdiWallet.deployed();

    await gsdiWallet.initialize(gsdiNFT.address, executor.address);

    usdt = await ethers.getContractAt("IERC20", usdt_address);
  });

  describe("gsdiChainId", () => {
    it("Should return gsdiChainId", async () => {
      expect(await gsdiNFT.callStatic.gsdiChainId(gsdiId.toFixed())).to.equal(chainId.toString())
    });
  });

  describe("setIsFeeEnabled", () => {
    it("Should be able to set isFeeEnabled", async () => {
      await gsdiNFT.setIsFeeEnabled(true);
      expect(await gsdiNFT.callStatic.isFeeEnabled()).to.equal(true);

      await gsdiNFT.setIsFeeEnabled(false);
      expect(await gsdiNFT.callStatic.isFeeEnabled()).to.equal(false);
    });
  });

  describe("setTreasury", () => {
    it("Should revert if treasure is not contract", async () => {
      await expect(gsdiNFT.setTreasury(treasury.address)).to.be.revertedWith("Invalid address");
    });
    it("Should be able to set treasury", async () => {
      await gsdiNFT.setTreasury(gsdiNFT.address);
      expect(await gsdiNFT.callStatic.treasury()).to.equal(gsdiNFT.address);
    });
  });

  describe("setGovernance", () => {
    it("Should revert if governance is not contract", async () => {
      await expect(gsdiNFT.setGovernance(treasury.address)).to.be.revertedWith("Invalid address");
    });
    it("Should be able to set governance", async () => {
      await gsdiNFT.setGovernance(gsdiNFT.address);
      expect(await gsdiNFT.callStatic.governance()).to.equal(gsdiNFT.address);
    });
  });
  
  describe("propose", () => {
    it("Should revert if an invalid executor", async () => {
      const current = (await ethers.provider.getBlock()).timestamp;
      await expect(gsdiNFT.propose(current + 20, 100, 1, gsdiWallet.address, usdt_address, borrower.address)).to.be.revertedWith("Wallet executor must be sender");
    })
    it("Should be able to propose", async () => {
      expect(await gsdiWallet.callStatic.executor()).to.equal(executor.address);

      const current = (await ethers.provider.getBlock()).timestamp;
      await gsdiNFT.connect(executor).propose(current + 20, 100, 1, gsdiWallet.address, usdt_address, borrower.address)

      console.log(executor.address)
      expect(await gsdiWallet.callStatic.executor()).to.equal(gsdiNFT.address);
    })
  })
});
