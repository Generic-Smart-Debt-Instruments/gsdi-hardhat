const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { time } = require("@openzeppelin/test-helpers");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const { expect } = chai;

chai.use(solidity);

const weth_address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("GSDINFT", () => {
  let gsdiId, chainId;
  let owner, treasury, executor, borrower;
  let gsdiNFT, gsdiWallet;
  let weth;
  let borrower_receiver;

  const maturity = 10;

  const faceValue = BigNumber.from("2000000000000000000");
  const price = BigNumber.from("1000000000000000000");

  const timeTravel = async (seconds) => {
    await time.increase(seconds);
  };

  before(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    treasury = accounts[1];
    executor = accounts[2];
    borrower = accounts[3];
    new_borrower = accounts[4];
    user = accounts[5];
    lender = accounts[6];

    const network = await ethers.provider.getNetwork();
    chainId = BigNumber.from(network.chainId);
    gsdiId = chainId.mul(BigNumber.from(2).pow(160));

    const gsdiNFTFactory = await ethers.getContractFactory("GSDINFT");
    gsdiNFT = await gsdiNFTFactory.deploy(chainId.toString());
    await gsdiNFT.deployed();

    const gsdiWalletFactory = await ethers.getContractFactory("GSDIWallet");
    gsdiWallet = await gsdiWalletFactory.deploy();
    await gsdiWallet.deployed();

    const mockBorrowerReceiverFactory = await ethers.getContractFactory(
      "MockGSDIBorrowerReceiver"
    );
    borrower_receiver = await mockBorrowerReceiverFactory.deploy();
    await borrower_receiver.deployed();

    await gsdiWallet.initialize(gsdiNFT.address, executor.address);

    weth = await ethers.getContractAt("IWETH", weth_address);
  });

  describe("gsdiChainId", () => {
    it("Should return gsdiChainId", async () => {
      expect(await gsdiNFT.callStatic.gsdiChainId(gsdiId)).to.equal(
        chainId.toString()
      );
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
      await expect(gsdiNFT.setTreasury(treasury.address)).to.be.revertedWith(
        "Invalid address"
      );
    });
    it("Should be able to set treasury", async () => {
      await gsdiNFT.setTreasury(gsdiNFT.address);
      expect(await gsdiNFT.callStatic.treasury()).to.equal(gsdiNFT.address);
    });
  });

  describe("setGovernance", () => {
    it("Should revert if governance is not contract", async () => {
      await expect(gsdiNFT.setGovernance(treasury.address)).to.be.revertedWith(
        "Invalid address"
      );
    });
    it("Should be able to set governance", async () => {
      await gsdiNFT.setGovernance(gsdiNFT.address);
      expect(await gsdiNFT.callStatic.governance()).to.equal(gsdiNFT.address);
    });
  });

  describe("propose", () => {
    it("Should revert if an invalid executor", async () => {
      const current = (await ethers.provider.getBlock()).timestamp;
      await expect(
        gsdiNFT.propose(
          current + maturity,
          faceValue,
          price,
          gsdiWallet.address,
          weth_address,
          borrower.address
        )
      ).to.be.revertedWith("Wallet executor must be sender");
    });
    it("Should be able to propose", async () => {
      expect(await gsdiWallet.callStatic.executor()).to.equal(executor.address);

      const current = (await ethers.provider.getBlock()).timestamp;
      await gsdiNFT
        .connect(executor)
        .propose(
          current + maturity,
          faceValue,
          price,
          gsdiWallet.address,
          weth_address,
          borrower.address
        );

      expect(await gsdiWallet.callStatic.executor()).to.equal(gsdiNFT.address);
    });
  });

  describe("metadata", () => {
    it("Should be able to get metadata: in proposal", async () => {
      const metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[6]).to.be.true;
    });
  });

  describe("transfer borrower", () => {
    it("Should revert if it's not a borrower", async () => {
      await expect(
        gsdiNFT.transferBorrower(gsdiId, new_borrower.address)
      ).to.be.revertedWith("Sender must be borrower");
    });
    it("Should be able to transfer borrower", async () => {
      let metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[5]).to.be.equal(borrower.address);
      await gsdiNFT
        .connect(borrower)
        .transferBorrower(gsdiId, new_borrower.address);
      metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[5]).to.be.equal(new_borrower.address);
      await gsdiNFT
        .connect(new_borrower)
        .transferBorrower(gsdiId, borrower.address);
      metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[5]).to.be.equal(borrower.address);
    });
  });

  describe("transfer borrower and call", () => {
    it("Should revert if it's not a borrower", async () => {
      await expect(
        gsdiNFT.transferBorrowerAndCall(
          gsdiId,
          borrower_receiver.address,
          1000,
          [0]
        )
      ).to.be.revertedWith("Sender must be borrower");
    });
    it("Should be able to transfer borrower", async () => {
      let metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[5]).to.be.equal(borrower.address);
      await gsdiNFT
        .connect(borrower)
        .transferBorrowerAndCall(gsdiId, borrower_receiver.address, 1000, [0]);
      metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[5]).to.be.equal(borrower_receiver.address);

      expect(await borrower_receiver.callStatic.sender()).to.be.equal(
        borrower.address
      );
      expect(await borrower_receiver.callStatic.value()).to.be.equal(1000);
      expect(await borrower_receiver.callStatic.data()).to.be.equal("0x00");
    });
  });

  describe("cancel", () => {
    it("Should revert if it's not in proposal", async () => {
      const gsdiWalletFactory = await ethers.getContractFactory("GSDIWallet");
      gsdiWallet = await gsdiWalletFactory.deploy();
      await gsdiWallet.deployed();
      await gsdiWallet.initialize(gsdiNFT.address, executor.address);

      expect(await gsdiWallet.callStatic.executor()).to.equal(executor.address);

      const current = (await ethers.provider.getBlock()).timestamp;
      await gsdiNFT
        .connect(executor)
        .propose(
          current + maturity,
          faceValue,
          price,
          gsdiWallet.address,
          weth_address,
          borrower.address
        );

      expect(await gsdiWallet.callStatic.executor()).to.equal(gsdiNFT.address);

      gsdiId = gsdiId.add(1);

      await expect(gsdiNFT.cancel(gsdiId.add(1))).to.be.revertedWith(
        "GSDI must be in proposal"
      );
    });
    it("Should revert if it's not a borrower", async () => {
      await expect(gsdiNFT.cancel(gsdiId)).to.be.revertedWith(
        "GSDINFT: Sender must be borrower"
      );
    });
    it("Should be able to cancel", async () => {
      await gsdiNFT.connect(borrower).cancel(gsdiId);
    });
    it("Metadata not in proposal", async () => {
      const metadata = await gsdiNFT.callStatic.metadata(gsdiId);
      expect(metadata[6]).to.be.false;
    });
  });

  describe("purchase", () => {
    it("Should revert if insufficient balance", async () => {
      const gsdiWalletFactory = await ethers.getContractFactory("GSDIWallet");
      gsdiWallet = await gsdiWalletFactory.deploy();
      await gsdiWallet.deployed();
      await gsdiWallet.initialize(gsdiNFT.address, executor.address);

      expect(await gsdiWallet.callStatic.executor()).to.equal(executor.address);

      const current = (await ethers.provider.getBlock()).timestamp;
      await gsdiNFT
        .connect(executor)
        .propose(
          current + maturity,
          faceValue,
          price,
          gsdiWallet.address,
          weth_address,
          borrower.address
        );
      gsdiId = gsdiId.add(1);

      expect(await gsdiWallet.callStatic.executor()).to.equal(gsdiNFT.address);

      await expect(gsdiNFT.connect(lender).purchase(gsdiId)).to.be.revertedWith("Transaction reverted without a reason");
    });

    it("Should purchase", async () => {
      await gsdiNFT.setIsFeeEnabled(true);
      expect(await gsdiNFT.callStatic.isFeeEnabled()).to.equal(true);

      const fee = price.mul(BigNumber.from(30)).div(BigNumber.from(10000));
      await weth.connect(lender).deposit({value: price.add(fee)});
      await weth.connect(lender).approve(gsdiNFT.address, price.add(fee));

      const balanceBeforeBorrower = await weth.callStatic.balanceOf(borrower.address);
      const balanceBeforeLender = await weth.callStatic.balanceOf(lender.address);

      await gsdiNFT.connect(lender).purchase(gsdiId);

      const balanceAfterBorrower = await weth.callStatic.balanceOf(borrower.address);
      const balanceAfterLender = await weth.callStatic.balanceOf(lender.address);

      expect(balanceBeforeBorrower.add(price)).to.be.equal(balanceAfterBorrower);
      expect(balanceAfterLender.add(price.add(fee))).to.be.equal(balanceBeforeLender);
      expect(await gsdiNFT.ownerOf(gsdiId)).to.be.equal(lender.address)
    });
  });

  describe("cover", () => {
    it("Should revert if insufficient allowance", async () => {
      await expect(gsdiNFT.connect(user).cover(gsdiId)).to.be.reverted;
    });

    it("Should cover", async () => {
      const metadata = await gsdiNFT.callStatic.metadata(gsdiId);

      await weth
        .connect(user)
        .deposit({ from: user.address, value: metadata[1] });
      await weth.connect(user).approve(gsdiNFT.address, metadata[1]);

      const balanceBeforeBorrower = await weth.callStatic.balanceOf(user.address);
      const balanceBeforeLender = await weth.callStatic.balanceOf(lender.address);

      await gsdiNFT.connect(user).cover(gsdiId);

      const balanceAfterBorrower = await weth.callStatic.balanceOf(user.address);
      const balanceAfterLender = await weth.callStatic.balanceOf(lender.address);

      expect(balanceAfterBorrower.add(metadata[1])).to.be.equal(balanceBeforeBorrower);
      expect(balanceBeforeLender.add(metadata[1])).to.be.equal(balanceAfterLender);
      await expect(gsdiNFT.ownerOf(gsdiId)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
  });

  describe("seize", () => {
    it("Should revert if it's not a lender", async () => {
      const gsdiWalletFactory = await ethers.getContractFactory("GSDIWallet");
      gsdiWallet = await gsdiWalletFactory.deploy();
      await gsdiWallet.deployed();
      await gsdiWallet.initialize(gsdiNFT.address, executor.address);

      expect(await gsdiWallet.callStatic.executor()).to.equal(executor.address);

      const current = (await ethers.provider.getBlock()).timestamp;
      await gsdiNFT
        .connect(executor)
        .propose(
          current + maturity,
          faceValue,
          price,
          gsdiWallet.address,
          weth_address,
          borrower.address
        );
      gsdiId = gsdiId.add(1);
      
      const fee = price.mul(BigNumber.from(30)).div(BigNumber.from(10000));
      await weth.connect(lender).deposit({value: price.add(fee)});
      await weth.connect(lender).approve(gsdiNFT.address, price.add(fee));

      await gsdiNFT.connect(lender).purchase(gsdiId);

      await expect(gsdiNFT.connect(user).seize(gsdiId)).to.be.revertedWith(
        "GSDINFT: The GSDI must be held by sender."
      );
    });

    it("Should revert if invalid maturity", async () => {
      await expect(gsdiNFT.connect(lender).seize(gsdiId)).to.be.revertedWith(
        "GSDINFT: Must be after maturity."
      );
    });

    it("Should seize", async () => {
      await timeTravel(maturity * 1000);

      expect(await gsdiWallet.callStatic.executor()).to.be.equal(
        gsdiNFT.address
      );
      expect(await gsdiNFT.ownerOf(gsdiId)).to.be.equal(lender.address);

      await gsdiNFT.connect(lender).seize(gsdiId);

      expect(await gsdiWallet.callStatic.executor()).to.be.equal(
        lender.address
      );
      await expect(gsdiNFT.ownerOf(gsdiId)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
  });
});
