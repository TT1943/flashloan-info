import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import { client } from '../apollo/client'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTimeframe } from './Application'
import {
  getPercentChange,
  getBlockFromTimestamp,
  getBlocksFromTimestamps,
  get2DayPercentChange,
  getTimeframe,
} from '../utils'
import {
  GLOBAL_DATA,
  GLOBAL_TXNS,
  GLOBAL_CHART,
  ETH_PRICE,
  ALL_POOLS,
  ALL_TOKENS,
  TOP_LPS_PER_POOLS,
} from '../apollo/queries'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { useAllPoolData } from './PoolData'
const UPDATE = 'UPDATE'
const UPDATE_TXNS = 'UPDATE_TXNS'
const UPDATE_CHART = 'UPDATE_CHART'
const UPDATE_ETH_PRICE = 'UPDATE_ETH_PRICE'
const ETH_PRICE_KEY = 'ETH_PRICE_KEY'
const UPDATE_ALL_POOLS_IN_DEERFI = 'UPDAUPDATE_ALL_POOLS_IN_DEERFITE_TOP_POOLS'
const UPDATE_ALL_TOKENS_IN_DEERFI = 'UPDATE_ALL_TOKENS_IN_DEERFI'
const UPDATE_TOP_LPS = 'UPDATE_TOP_LPS'

// format dayjs with the libraries that we need
dayjs.extend(utc)
dayjs.extend(weekOfYear)

const GlobalDataContext = createContext()

function useGlobalDataContext() {
  return useContext(GlobalDataContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { data } = payload
      return {
        ...state,
        globalData: data,
      }
    }
    case UPDATE_TXNS: {
      const { transactions } = payload
      return {
        ...state,
        transactions,
      }
    }
    case UPDATE_CHART: {
      const { daily, weekly } = payload
      return {
        ...state,
        chartData: {
          daily,
          weekly,
        },
      }
    }
    case UPDATE_ETH_PRICE: {
      const { ethPrice, oneDayPrice, ethPriceChange } = payload
      return {
        [ETH_PRICE_KEY]: ethPrice,
        oneDayPrice,
        ethPriceChange,
      }
    }

    case UPDATE_ALL_POOLS_IN_DEERFI: {
      const { allPools } = payload
      return {
        ...state,
        allPools,
      }
    }

    case UPDATE_ALL_TOKENS_IN_DEERFI: {
      const { allTokens } = payload
      return {
        ...state,
        allTokens,
      }
    }

    case UPDATE_TOP_LPS: {
      const { topLps } = payload
      return {
        ...state,
        topLps,
      }
    }
    default: {
      throw Error(`Unexpected action type in DataContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})
  const update = useCallback((data) => {
    dispatch({
      type: UPDATE,
      payload: {
        data,
      },
    })
  }, [])

  const updateTransactions = useCallback((transactions) => {
    dispatch({
      type: UPDATE_TXNS,
      payload: {
        transactions,
      },
    })
  }, [])

  const updateChart = useCallback((daily, weekly) => {
    dispatch({
      type: UPDATE_CHART,
      payload: {
        daily,
        weekly,
      },
    })
  }, [])

  const updateEthPrice = useCallback((ethPrice, oneDayPrice, ethPriceChange) => {
    dispatch({
      type: UPDATE_ETH_PRICE,
      payload: {
        ethPrice,
        oneDayPrice,
        ethPriceChange,
      },
    })
  }, [])

  const updateAllPoolsInDeerfi = useCallback((allPools) => {
    dispatch({
      type: UPDATE_ALL_POOLS_IN_DEERFI,
      payload: {
        allPools,
      },
    })
  }, [])

  const updateAllTokensInDeerfi = useCallback((allTokens) => {
    dispatch({
      type: UPDATE_ALL_TOKENS_IN_DEERFI,
      payload: {
        allTokens,
      },
    })
  }, [])

  const updateTopLps = useCallback((topLps) => {
    dispatch({
      type: UPDATE_TOP_LPS,
      payload: {
        topLps,
      },
    })
  }, [])
  return (
    <GlobalDataContext.Provider
      value={useMemo(
        () => [
          state,
          {
            update,
            updateTransactions,
            updateChart,
            updateEthPrice,
            updateTopLps,
            updateAllPoolsInDeerfi,
            updateAllTokensInDeerfi,
          },
        ],
        [
          state,
          update,
          updateTransactions,
          updateTopLps,
          updateChart,
          updateEthPrice,
          updateAllPoolsInDeerfi,
          updateAllTokensInDeerfi,
        ]
      )}
    >
      {children}
    </GlobalDataContext.Provider>
  )
}

/**
 * Gets all the global data for the overview page.
 * Needs current eth price and the old eth price to get
 * 24 hour USD changes.
 * @param {*} ethPrice
 * @param {*} oldEthPrice
 */
async function getGlobalData(ethPrice, oldEthPrice) {
  // data for each day , historic data used for % changes
  let data = {}
  let oneDayData = {}
  let twoDayData = {}

  try {
    // get timestamps for the days
    const utcCurrentTime = dayjs()
    const utcOneDayBack = utcCurrentTime.subtract(1, 'day').unix()
    const utcTwoDaysBack = utcCurrentTime.subtract(2, 'day').unix()
    const utcOneWeekBack = utcCurrentTime.subtract(1, 'week').unix()
    const utcTwoWeeksBack = utcCurrentTime.subtract(2, 'week').unix()

    // get the blocks needed for time travel queries
    let [oneDayBlock, twoDayBlock, oneWeekBlock, twoWeekBlock] = await getBlocksFromTimestamps([
      utcOneDayBack,
      utcTwoDaysBack,
      utcOneWeekBack,
      utcTwoWeeksBack,
    ])

    // fetch the global data
    let result = await client.query({
      query: GLOBAL_DATA(),
      fetchPolicy: 'cache-first',
    })
    data = result.data.flashLoanFactories[0]

    // fetch the historical data
    let oneDayResult = await client.query({
      query: GLOBAL_DATA(oneDayBlock?.number),
      fetchPolicy: 'cache-first',
    })
    oneDayData = oneDayResult.data.flashLoanFactories[0]

    let twoDayResult = await client.query({
      query: GLOBAL_DATA(twoDayBlock?.number),
      fetchPolicy: 'cache-first',
    })
    twoDayData = twoDayResult.data.flashLoanFactories[0]

    let oneWeekResult = await client.query({
      query: GLOBAL_DATA(oneWeekBlock?.number),
      fetchPolicy: 'cache-first',
    })
    const oneWeekData = oneWeekResult.data.flashLoanFactories[0]

    let twoWeekResult = await client.query({
      query: GLOBAL_DATA(twoWeekBlock?.number),
      fetchPolicy: 'cache-first',
    })
    const twoWeekData = twoWeekResult.data.flashLoanFactories[0]

    if (data && oneDayData && twoDayData && twoWeekData) {
      let [oneDayVolumeUSD, volumeChangeUSD] = get2DayPercentChange(
        data.totalVolumeUSD,
        oneDayData.totalVolumeUSD ? oneDayData.totalVolumeUSD : 0,
        twoDayData.totalVolumeUSD ? twoDayData.totalVolumeUSD : 0
      )

      const [oneWeekVolume, weeklyVolumeChange] = get2DayPercentChange(
        data.totalVolumeUSD,
        oneWeekData.totalVolumeUSD,
        twoWeekData.totalVolumeUSD
      )

      const [oneDayTxns, txnChange] = get2DayPercentChange(
        data.txCount,
        oneDayData.txCount ? oneDayData.txCount : 0,
        twoDayData.txCount ? twoDayData.txCount : 0
      )

      // format the total liquidity in USD
      data.totalLiquidityUSD = data.totalLiquidityETH * ethPrice
      const liquidityChangeUSD = getPercentChange(
        data.totalLiquidityETH * ethPrice,
        oneDayData.totalLiquidityETH * oldEthPrice
      )

      // add relevant fields with the calculated amounts
      data.oneDayVolumeUSD = oneDayVolumeUSD
      data.oneWeekVolume = oneWeekVolume
      data.weeklyVolumeChange = weeklyVolumeChange
      data.volumeChangeUSD = volumeChangeUSD
      data.liquidityChangeUSD = liquidityChangeUSD
      data.oneDayTxns = oneDayTxns
      data.txnChange = txnChange
    }
  } catch (e) {
    console.log(e)
  }

  return data
}

/**
 * Get historical data for volume and liquidity used in global charts
 * on main page
 * @param {*} oldestDateToFetch // start of window to fetch from
 */
const getChartData = async (oldestDateToFetch) => {
  let data = []
  let weeklyData = []
  const utcEndTime = dayjs.utc()
  let skip = 0
  let allFound = false

  try {
    while (!allFound) {
      let result = await client.query({
        query: GLOBAL_CHART,
        variables: {
          startTime: oldestDateToFetch,
          skip,
        },
        fetchPolicy: 'cache-first',
      })
      skip += 1000
      data = data.concat(result.data.flashLoanDayDatas)
      if (result.data.flashLoanDayDatas.length < 1000) {
        allFound = true
      }
    }

    if (data) {
      let dayIndexSet = new Set()
      let dayIndexArray = []
      const oneDay = 24 * 60 * 60

      // for each day, parse the daily volume and format for chart array
      data.forEach((dayData, i) => {
        // add the day index to the set of days
        dayIndexSet.add((data[i].date / oneDay).toFixed(0))
        dayIndexArray.push(data[i])
        dayData.dailyVolumeUSD = parseFloat(dayData.dailyVolumeUSD)
      })

      // fill in empty days ( there will be no day datas if no trades made that day )
      let timestamp = data[0].date ? data[0].date : oldestDateToFetch
      let latestLiquidityUSD = data[0].totalLiquidityUSD
      let latestDayDats = data[0].mostLiquidTokens
      let index = 1
      while (timestamp < utcEndTime.unix() - oneDay) {
        const nextDay = timestamp + oneDay
        let currentDayIndex = (nextDay / oneDay).toFixed(0)
        if (!dayIndexSet.has(currentDayIndex)) {
          data.push({
            date: nextDay,
            dailyVolumeUSD: 0,
            totalLiquidityUSD: latestLiquidityUSD,
            mostLiquidTokens: latestDayDats,
          })
        } else {
          latestLiquidityUSD = dayIndexArray[index].totalLiquidityUSD
          latestDayDats = dayIndexArray[index].mostLiquidTokens
          index = index + 1
        }
        timestamp = nextDay
      }
    }

    // format weekly data for weekly sized chunks
    data = data.sort((a, b) => (parseInt(a.date) > parseInt(b.date) ? 1 : -1))
    let startIndexWeekly = -1
    let currentWeek = -1
    data.forEach((entry, i) => {
      const week = dayjs.utc(dayjs.unix(data[i].date)).week()
      if (week !== currentWeek) {
        currentWeek = week
        startIndexWeekly++
      }
      weeklyData[startIndexWeekly] = weeklyData[startIndexWeekly] || {}
      weeklyData[startIndexWeekly].date = data[i].date
      weeklyData[startIndexWeekly].weeklyVolumeUSD =
        (weeklyData[startIndexWeekly].weeklyVolumeUSD ?? 0) + data[i].dailyVolumeUSD
    })
  } catch (e) {
    console.log(e)
  }
  return [data, weeklyData]
}

/**
 * Get and format transactions for global page
 */
const getGlobalTransactions = async () => {
  let transactions = {}

  try {
    let result = await client.query({
      query: GLOBAL_TXNS,
      fetchPolicy: 'cache-first',
    })
    transactions.mints = []
    transactions.burns = []
    transactions.flashLoans = []
    result?.data?.transactions &&
      result.data.transactions.map((transaction) => {
        if (transaction.mints.length > 0) {
          transaction.mints.map((mint) => {
            return transactions.mints.push(mint)
          })
        }
        if (transaction.burns.length > 0) {
          transaction.burns.map((burn) => {
            return transactions.burns.push(burn)
          })
        }
        if (transaction.flashLoans.length > 0) {
          transaction.flashLoans.map((flashLoan) => {
            return transactions.flashLoans.push(flashLoan)
          })
        }
        return true
      })
  } catch (e) {
    console.log(e)
  }

  return transactions
}

/**
 * Gets the current price  of ETH, 24 hour price, and % change between them
 */
const getEthPrice = async () => {
  const utcCurrentTime = dayjs()
  const utcOneDayBack = utcCurrentTime.subtract(1, 'day').startOf('minute').unix()

  let ethPrice = 0
  let ethPriceOneDay = 0
  let priceChangeETH = 0

  try {
    let oneDayBlock = await getBlockFromTimestamp(utcOneDayBack)
    let result = await client.query({
      query: ETH_PRICE(),
      fetchPolicy: 'cache-first',
    })
    let resultOneDay = await client.query({
      query: ETH_PRICE(oneDayBlock),
      fetchPolicy: 'cache-first',
    })
    const currentPrice = result?.data?.bundles[0]?.ethPrice
    const oneDayBackPrice = resultOneDay?.data?.bundles[0]?.ethPrice
    priceChangeETH = getPercentChange(currentPrice, oneDayBackPrice)
    ethPrice = currentPrice
    ethPriceOneDay = oneDayBackPrice
  } catch (e) {
    console.log(e)
  }

  return [ethPrice, ethPriceOneDay, priceChangeETH]
}

const POOLS_TO_FETCH = 500
const TOKENS_TO_FETCH = 500

/**
 * Loop through every pool on deerfi, used for search
 */
async function getAllPoolsOnDeerfi() {
  try {
    let allFound = false
    let pools = []
    let skipCount = 0
    while (!allFound) {
      let result = await client.query({
        query: ALL_POOLS,
        variables: {
          skip: skipCount,
        },
        fetchPolicy: 'cache-first',
      })
      skipCount = skipCount + POOLS_TO_FETCH
      pools = pools.concat(result?.data?.pools)
      if (result?.data?.pools.length < POOLS_TO_FETCH || pools.length > POOLS_TO_FETCH) {
        allFound = true
      }
    }
    return pools
  } catch (e) {
    console.log(e)
  }
}

/**
 * Loop through every token on deerfi, used for search
 */
async function getAllTokensOnDeerfi() {
  try {
    let allFound = false
    let skipCount = 0
    let tokens = []
    while (!allFound) {
      let result = await client.query({
        query: ALL_TOKENS,
        variables: {
          skip: skipCount,
        },
        fetchPolicy: 'cache-first',
      })
      tokens = tokens.concat(result?.data?.tokens)
      if (result?.data?.tokens?.length < TOKENS_TO_FETCH || tokens.length > TOKENS_TO_FETCH) {
        allFound = true
      }
      skipCount = skipCount += TOKENS_TO_FETCH
    }
    return tokens
  } catch (e) {
    console.log(e)
  }
}

/**
 * Hook that fetches overview data, plus all tokens and pools for search
 */
export function useGlobalData() {
  const [state, { update, updateAllPoolsInDeerfi, updateAllTokensInDeerfi }] = useGlobalDataContext()
  const [ethPrice, oldEthPrice] = useEthPrice()

  const data = state?.globalData

  useEffect(() => {
    async function fetchData() {
      let globalData = await getGlobalData(ethPrice, oldEthPrice)
      globalData && update(globalData)

      let allPools = await getAllPoolsOnDeerfi()
      updateAllPoolsInDeerfi(allPools)

      let allTokens = await getAllTokensOnDeerfi()
      updateAllTokensInDeerfi(allTokens)
    }
    if (!data && ethPrice && oldEthPrice) {
      fetchData()
    }
  }, [ethPrice, oldEthPrice, update, data, updateAllPoolsInDeerfi, updateAllTokensInDeerfi])

  return data || {}
}

export function useGlobalChartData() {
  const [state, { updateChart }] = useGlobalDataContext()
  const [oldestDateFetch, setOldestDateFetched] = useState()
  const [activeWindow] = useTimeframe()

  const chartDataDaily = state?.chartData?.daily
  const chartDataWeekly = state?.chartData?.weekly

  /**
   * Keep track of oldest date fetched. Used to
   * limit data fetched until its actually needed.
   * (dont fetch year long stuff unless year option selected)
   */
  useEffect(() => {
    // based on window, get starttime
    let startTime = getTimeframe(activeWindow)

    if ((activeWindow && startTime < oldestDateFetch) || !oldestDateFetch) {
      setOldestDateFetched(startTime)
    }
  }, [activeWindow, oldestDateFetch])

  /**
   * Fetch data if none fetched or older data is needed
   */
  useEffect(() => {
    async function fetchData() {
      // historical stuff for chart
      let [newChartData, newWeeklyData] = await getChartData(oldestDateFetch)
      updateChart(newChartData, newWeeklyData)
    }
    if (oldestDateFetch && !(chartDataDaily && chartDataWeekly)) {
      fetchData()
    }
  }, [chartDataDaily, chartDataWeekly, oldestDateFetch, updateChart])

  return [chartDataDaily, chartDataWeekly]
}

export function useGlobalTransactions() {
  const [state, { updateTransactions }] = useGlobalDataContext()
  const transactions = state?.transactions
  useEffect(() => {
    async function fetchData() {
      if (!transactions) {
        let txns = await getGlobalTransactions()
        updateTransactions(txns)
      }
    }
    fetchData()
  }, [updateTransactions, transactions])
  return transactions
}

export function useEthPrice() {
  const [state, { updateEthPrice }] = useGlobalDataContext()
  const ethPrice = state?.[ETH_PRICE_KEY]
  const ethPriceOld = state?.['oneDayPrice']
  useEffect(() => {
    async function checkForEthPrice() {
      if (!ethPrice) {
        let [newPrice, oneDayPrice, priceChange] = await getEthPrice()
        updateEthPrice(newPrice, oneDayPrice, priceChange)
      }
    }
    checkForEthPrice()
  }, [ethPrice, updateEthPrice])

  return [ethPrice, ethPriceOld]
}

export function useAllPoolsInDeerfi() {
  const [state] = useGlobalDataContext()
  let allPools = state?.allPools

  return allPools || []
}

export function useAllTokensInDeerfi() {
  const [state] = useGlobalDataContext()
  let allTokens = state?.allTokens

  return allTokens || []
}

/**
 * Get the top liquidity positions based on USD size
 * @TODO Not a perfect lookup needs improvement
 */
export function useTopLps() {
  const [state, { updateTopLps }] = useGlobalDataContext()
  let topLps = state?.topLps

  const allPools = useAllPoolData()

  useEffect(() => {
    async function fetchData() {
      // get top 20 by reserves
      let topPools = Object.keys(allPools)
        ?.sort((a, b) => parseFloat(allPools[a].reserveUSD > allPools[b].reserveUSD ? -1 : 1))
        ?.slice(0, 99)
        .map((pool) => pool)

      let topLpLists = await Promise.all(
        topPools.map(async (pool) => {
          // for each one, fetch top LPs
          try {
            const { data: results } = await client.query({
              query: TOP_LPS_PER_POOLS,
              variables: {
                pool: pool.toString(),
              },
              fetchPolicy: 'cache-first',
            })
            if (results) {
              return results.liquidityPositions
            }
          } catch (e) {}
        })
      )

      // get the top lps from the results formatted
      const topLps = []
      topLpLists
        .filter((i) => !!i) // check for ones not fetched correctly
        .map((list) => {
          return list.map((entry) => {
            const poolData = allPools[entry.pool.id]
            return topLps.push({
              user: entry.user,
              poolName: poolData.token.symbol + ' Pool',
              poolAddress: entry.pool.id,
              token: poolData.token.id,
              usd:
                (parseFloat(entry.liquidityTokenBalance) / parseFloat(poolData.totalSupply)) *
                parseFloat(poolData.reserveUSD),
            })
          })
        })

      const sorted = topLps.sort((a, b) => (a.usd > b.usd ? -1 : 1))
      const shorter = sorted.splice(0, 100)
      updateTopLps(shorter)
    }

    if (!topLps && allPools && Object.keys(allPools).length > 0) {
      fetchData()
    }
  })

  return topLps
}