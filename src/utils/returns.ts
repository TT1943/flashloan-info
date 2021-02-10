import { USER_MINTS_BUNRS_PER_POOL } from '../apollo/queries'
import { client } from '../apollo/client'
import dayjs from 'dayjs'
import { getShareValueOverTime } from '.'

export const priceOverrides = [
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
]

interface ReturnMetrics {
  hodleReturn: number // difference in asset values t0 -> t1 with t0 deposit amounts
  netReturn: number // net return from t0 -> t1
  deerfiReturn: number // netReturn - hodlReturn
  impLoss: number
  fees: number
}

// used to calculate returns within a given window bounded by two positions
interface Position {
  pool: any
  liquidityTokenBalance: number
  liquidityTokenTotalSupply: number
  reserve: number
  reserveUSD: number
  tokenPriceUSD: number
}

const PRICE_DISCOVERY_START_TIMESTAMP = 1589747086

function formatPricesForEarlyTimestamps(position): Position {
  if (position.timestamp < PRICE_DISCOVERY_START_TIMESTAMP) {
    if (priceOverrides.includes(position?.pool?.token.id)) {
      position.tokenPriceUSD = 1
    }
    // WETH price
    if (position.pool?.token.id === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
      position.tokenPriceUSD = 203
    }
  }
  return position
}

async function getPrincipalForUserPerPool(user: string, poolAddress: string) {
  let usd = 0
  let amount = 0
  // get all minst and burns to get principal amounts
  const results = await client.query({
    query: USER_MINTS_BUNRS_PER_POOL,
    variables: {
      user,
      pool: poolAddress,
    },
  })
  for (const index in results.data.mints) {
    const mint = results.data.mints[index]
    const mintToken = mint.pool.token.id

    // if trackign before prices were discovered (pre-launch days), hardcode stablecoins
    if (priceOverrides.includes(mintToken) && mint.timestamp < PRICE_DISCOVERY_START_TIMESTAMP) {
      usd += parseFloat(mint.amount)
    } else {
      usd += parseFloat(mint.amountUSD)
    }
    amount += amount + parseFloat(mint.amount)
  }

  for (const index in results.data.burns) {
    const burn = results.data.burns[index]
    const burnToken = burn.pool.token.id

    // if trackign before prices were discovered (pre-launch days), hardcode stablecoins
    if (priceOverrides.includes(burnToken) && burn.timestamp < PRICE_DISCOVERY_START_TIMESTAMP) {
      usd += parseFloat(burn.amount0)
    } else {
      usd -= parseFloat(results.data.burns[index].amountUSD)
    }

    amount -= parseFloat(results.data.burns[index].amount)
  }

  return { usd, amount }
}

/**
 * Core algorithm for calculating retursn within one time window.
 * @param positionT0 // users liquidity info and token rates at beginning of window
 * @param positionT1 // '' at the end of the window
 */
export function getMetricsForPositionWindow(positionT0: Position, positionT1: Position): ReturnMetrics {
  positionT0 = formatPricesForEarlyTimestamps(positionT0)
  positionT1 = formatPricesForEarlyTimestamps(positionT1)

  // calculate ownership at ends of window, for end of window we need original LP token balance / new total supply
  const t0Ownership = positionT0.liquidityTokenBalance / positionT0.liquidityTokenTotalSupply
  const t1Ownership = positionT0.liquidityTokenBalance / positionT1.liquidityTokenTotalSupply

  // get starting amounts of token0 and token1 deposited by LP
  const token_amount_t0 = t0Ownership * positionT0.reserve

  // get current token values
  const token_amount_t1 = t1Ownership * positionT1.reserve

  // find imp loss and fee differences
  const K_t0 = token_amount_t0
  // eslint-disable-next-line eqeqeq
  const priceRatioT1 = positionT1.tokenPriceUSD != 0 ? positionT1.tokenPriceUSD / positionT1.tokenPriceUSD : 0

  const token0_amount_no_fees = positionT1.tokenPriceUSD && priceRatioT1 ? K_t0 * priceRatioT1 : 0

  const no_fees_usd = token0_amount_no_fees * positionT1.tokenPriceUSD

  const difference_fees_token0 = token_amount_t1 - token0_amount_no_fees

  const difference_fees_usd =
    difference_fees_token0 * positionT1.tokenPriceUSD

  // calculate USD value at t0 and t1 using initial token deposit amounts for asset return
  const assetValueT0 = token_amount_t0 * positionT0.tokenPriceUSD
  const assetValueT1 = token_amount_t1 * positionT1.tokenPriceUSD

  const imp_loss_usd = no_fees_usd - assetValueT1
  const DEERFI_RETURN = difference_fees_usd + imp_loss_usd

  // get net value change for combined data
  const netValueT0 = t0Ownership * positionT0.reserveUSD
  const netValueT1 = t1Ownership * positionT1.reserveUSD

  return {
    hodleReturn: assetValueT1 - assetValueT0,
    netReturn: netValueT1 - netValueT0,
    deerfiReturn: DEERFI_RETURN,
    impLoss: imp_loss_usd,
    fees: difference_fees_usd,
  }
}

/**
 * formats data for historical chart for an LPs position in 1 pool over time
 * @param startDateTimestamp // day to start tracking at
 * @param currentPoolData // current stat of the pool
 * @param poolSnapshots // history of entries and exits for lp on this pool
 * @param currentETHPrice // current price of eth used for usd conversions
 */
export async function getHistoricalPoolReturns(startDateTimestamp, currentPoolData, poolSnapshots, currentETHPrice) {
  // catch case where data not puplated yet
  if (!currentPoolData.createdAtTimestamp) {
    return []
  }
  let dayIndex: number = Math.round(startDateTimestamp / 86400) // get unique day bucket unix
  const currentDayIndex: number = Math.round(dayjs.utc().unix() / 86400)
  const sortedPositions = poolSnapshots.sort((a, b) => {
    return parseInt(a.timestamp) > parseInt(b.timestamp) ? 1 : -1
  })
  if (sortedPositions[0].timestamp > startDateTimestamp) {
    dayIndex = Math.round(sortedPositions[0].timestamp / 86400)
  }

  const dayTimestamps = []
  while (dayIndex < currentDayIndex) {
    // only account for days where this pool existed
    if (dayIndex * 86400 >= parseInt(currentPoolData.createdAtTimestamp)) {
      dayTimestamps.push(dayIndex * 86400)
    }
    dayIndex = dayIndex + 1
  }

  const shareValues = await getShareValueOverTime(currentPoolData.id, dayTimestamps)
  const shareValuesFormatted = {}
  shareValues?.map((share) => {
    shareValuesFormatted[share.timestamp] = share
  })

  // set the default position and data
  let positionT0 = poolSnapshots[0]
  const formattedHistory = []
  let netFees = 0

  // keep track of up to date metrics as we parse each day
  for (const index in dayTimestamps) {
    // get the bounds on the day
    const dayTimestamp = dayTimestamps[index]
    const timestampCeiling = dayTimestamp + 86400

    // for each change in position value that day, create a window and update
    const dailyChanges = poolSnapshots.filter((snapshot) => {
      return snapshot.timestamp < timestampCeiling && snapshot.timestamp > dayTimestamp
    })
    for (let i = 0; i < dailyChanges.length; i++) {
      const positionT1 = dailyChanges[i]
      const localReturns = getMetricsForPositionWindow(positionT0, positionT1)
      netFees = netFees + localReturns.fees
      positionT0 = positionT1
    }

    // now treat the end of the day as a hypothetical position
    let positionT1 = shareValuesFormatted[dayTimestamp + 86400]
    if (!positionT1) {
      positionT1 = {
        pool: currentPoolData.id,
        liquidityTokenBalance: positionT0.liquidityTokenBalance,
        totalSupply: currentPoolData.totalSupply,
        reserve: currentPoolData.reserve,
        reserveUSD: currentPoolData.reserveUSD,
        tokenPriceUSD: currentPoolData.token.derivedETH * currentETHPrice,
      }
    }

    if (positionT1) {
      positionT1.liquidityTokenTotalSupply = positionT1.totalSupply
      positionT1.liquidityTokenBalance = positionT0.liquidityTokenBalance
      const currentLiquidityValue =
        (parseFloat(positionT1.liquidityTokenBalance) / parseFloat(positionT1.liquidityTokenTotalSupply)) *
        parseFloat(positionT1.reserveUSD)
      const localReturns = getMetricsForPositionWindow(positionT0, positionT1)
      const localFees = netFees + localReturns.fees

      formattedHistory.push({
        date: dayTimestamp,
        usdValue: currentLiquidityValue,
        fees: localFees,
      })
    }
  }

  return formattedHistory
}

/**
 * For a given pool and user, get the return metrics
 * @param user
 * @param pool
 * @param ethPrice
 */
export async function getLPReturnsOnPool(user: string, pool, ethPrice: number, snapshots) {
  // initialize values
  const principal = await getPrincipalForUserPerPool(user, pool.id)
  let hodlReturn = 0
  let netReturn = 0
  let deerfiReturn = 0
  let fees = 0

  snapshots = snapshots.filter((entry) => {
    return entry.pool.id === pool.id
  })

  // get data about the current position
  const currentPosition: Position = {
    pool,
    liquidityTokenBalance: snapshots[snapshots.length - 1]?.liquidityTokenBalance,
    liquidityTokenTotalSupply: pool.totalSupply,
    reserve: pool.reserve,
    reserveUSD: pool.reserveUSD,
    tokenPriceUSD: pool.token.derivedETH * ethPrice,
  }

  for (const index in snapshots) {
    // get positions at both bounds of the window
    const positionT0 = snapshots[index]
    const positionT1 = parseInt(index) === snapshots.length - 1 ? currentPosition : snapshots[parseInt(index) + 1]

    const results = getMetricsForPositionWindow(positionT0, positionT1)
    hodlReturn = hodlReturn + results.hodleReturn
    netReturn = netReturn + results.netReturn
    deerfiReturn = deerfiReturn + results.deerfiReturn
    fees = fees + results.fees
  }

  return {
    principal,
    net: {
      return: netReturn,
    },
    deerfi: {
      return: deerfiReturn,
    },
    fees: {
      sum: fees,
    },
  }
}
