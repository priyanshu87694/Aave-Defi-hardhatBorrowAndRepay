const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")

async function main () {
    await getWeth()
    // ILendingPoolAddressProvider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)
    console.log(`Lending Pool Address: ${lendingPool.address}`)
    // deposit WETH
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // approve
    await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    // borrowing
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
    const daiPrice = await getDAIPrice()
    const amountToBorrow = availableBorrowsETH.toString() * 0.95 * (1/daiPrice.toNumber())
    console.log(`Borrow Possible: ${amountToBorrow}`)
    const amountToBorrowWei = ethers.utils.parseEther(amountToBorrow.toString())
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDAI(daiTokenAddress, lendingPool, amountToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)
    // repay
    await repayDAI(amountToBorrowWei, daiTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer)
}

async function getLendingPool (account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account
    )

    return lendingPool
}

async function approveERC20 (erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved!")
}

async function getBorrowUserData (lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account)
    console.log(`totalCollateralETH: ${totalCollateralETH}`)
    console.log(`totalDebtETH: ${totalDebtETH}`)
    console.log(`availableBorrowsETH: ${availableBorrowsETH}`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getDAIPrice () {
    const daiPriceFeed = await ethers.getContractAt("AggregatorV3Interface", "0x773616E4d11A78F511299002da57A0a94577F1f4")
    const price = (await daiPriceFeed.latestRoundData())[1]
    console.log(`DAI/ETH price feed: ${price.toString()}`)
    return price
}

async function borrowDAI(daiTokenAddress, lendingPool, amountToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(daiTokenAddress, amountToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log("Borrowed DAI")
}

async function repayDAI(amount, daiTokenAddress, lendingPool, account) {
    await approveERC20(daiTokenAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiTokenAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repayed!")
}

main ()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })