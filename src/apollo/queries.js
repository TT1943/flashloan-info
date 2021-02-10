import gql from 'graphql-tag'
import { FACTORY_ADDRESS, BUNDLE_ID } from '../constants'

export const SUBGRAPH_HEALTH = gql`
  query health {
    indexingStatusForCurrentVersion(subgraphName: "deerfi/flash-loan") {
      synced
      health
      chains {
        chainHeadBlock {
          number
        }
        latestBlock {
          number
        }
      }
    }
  }
`

export const V1_DATA_QUERY = gql`
  query uniswap($date: Int!, $date2: Int!) {
    current: uniswap(id: "1") {
      totalVolumeUSD
      totalLiquidityUSD
      txCount
    }
    oneDay: uniswapHistoricalDatas(where: { timestamp_lt: $date }, first: 1, orderBy: timestamp, orderDirection: desc) {
      totalVolumeUSD
      totalLiquidityUSD
      txCount
    }
    twoDay: uniswapHistoricalDatas(
      where: { timestamp_lt: $date2 }
      first: 1
      orderBy: timestamp
      orderDirection: desc
    ) {
      totalVolumeUSD
      totalLiquidityUSD
      txCount
    }
    exchanges(first: 200, orderBy: ethBalance, orderDirection: desc) {
      ethBalance
    }
  }
`

export const GET_BLOCK = gql`
  query blocks($timestampFrom: Int!, $timestampTo: Int!) {
    blocks(
      first: 1
      orderBy: timestamp
      orderDirection: asc
      where: { timestamp_gt: $timestampFrom, timestamp_lt: $timestampTo }
    ) {
      id
      number
      timestamp
    }
  }
`

export const GET_BLOCKS = (timestamps) => {
  let queryString = 'query blocks {'
  queryString += timestamps.map((timestamp) => {
    return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${timestamp + 600
      } }) {
      number
    }`
  })
  queryString += '}'
  return gql(queryString)
}

export const POSITIONS_BY_BLOCK = (account, blocks) => {
  let queryString = 'query blocks {'
  queryString += blocks.map(
    (block) => `
      t${block.timestamp}:liquidityPositions(where: {user: "${account}"}, block: { number: ${block.number} }) { 
        liquidityTokenBalance
        pool  {
          id
          totalSupply
          reserve
        }
      }
    `
  )
  queryString += '}'
  return gql(queryString)
}

export const PRICES_BY_BLOCK = (tokenAddress, blocks) => {
  let queryString = 'query blocks {'
  queryString += blocks.map(
    (block) => `
      t${block.timestamp}:token(id:"${tokenAddress}", block: { number: ${block.number} }) { 
        derivedETH
      }
    `
  )
  queryString += ','
  queryString += blocks.map(
    (block) => `
      b${block.timestamp}: bundle(id:"1", block: { number: ${block.number} }) { 
        ethPrice
      }
    `
  )

  queryString += '}'
  return gql(queryString)
}

export const TOP_LPS_PER_POOLS = gql`
  query lps($pool: Bytes!) {
    liquidityPositions(where: { pool: $pool }, orderBy: liquidityTokenBalance, orderDirection: desc, first: 10) {
      user {
        id
      }
      pool {
        id
      }
      liquidityTokenBalance
    }
  }
`

export const HOURLY_POOL_RATES = (poolAddress, blocks) => {
  let queryString = 'query blocks {'
  queryString += blocks.map(
    (block) => `
      t${block.timestamp}: pool(id:"${poolAddress}", block: { number: ${block.number} }) { 
        tokenPrice
      }
    `
  )

  queryString += '}'
  return gql(queryString)
}

export const SHARE_VALUE = (poolAddress, blocks) => {
  let queryString = 'query blocks {'
  queryString += blocks.map(
    (block) => `
      t${block.timestamp}:pool(id:"${poolAddress}", block: { number: ${block.number} }) { 
        reserve
        reserveUSD
        totalSupply 
        token{
          derivedETH
        }
      }
    `
  )
  queryString += ','
  queryString += blocks.map(
    (block) => `
      b${block.timestamp}: bundle(id:"1", block: { number: ${block.number} }) { 
        ethPrice
      }
    `
  )

  queryString += '}'
  return gql(queryString)
}

export const ETH_PRICE = (block) => {
  const queryString = block
    ? `
    query bundles {
      bundles(where: { id: ${BUNDLE_ID} } block: {number: ${block}}) {
        id
        ethPrice
      }
    }
  `
    : ` query bundles {
      bundles(where: { id: ${BUNDLE_ID} }) {
        id
        ethPrice
      }
    }
  `
  return gql(queryString)
}

export const USER = (block, account) => {
  const queryString = `
    query users {
      user(id: "${account}", block: {number: ${block}}) {
        liquidityPositions
      }
    }
`
  return gql(queryString)
}

export const USER_MINTS_BUNRS_PER_POOL = gql`
  query events($user: Bytes!, $pool: Bytes!) {
    mints(where: { to: $user, pool: $pool }) {
      amountUSD
      amount
      timestamp
      pool {
        token {
          id
        }
      }
    }
    burns(where: { sender: $user, pool: $pool }) {
      amountUSD
      amount
      timestamp
      pool {
        token {
          id
        }
      }
    }
  }
`

export const FIRST_SNAPSHOT = gql`
  query snapshots($user: Bytes!) {
    liquidityPositionSnapshots(first: 1, where: { user: $user }, orderBy: timestamp, orderDirection: asc) {
      timestamp
    }
  }
`

export const USER_HISTORY = gql`
  query snapshots($user: Bytes!, $skip: Int!) {
    liquidityPositionSnapshots(first: 1000, skip: $skip, where: { user: $user }) {
      timestamp
      reserveUSD
      liquidityTokenBalance
      liquidityTokenTotalSupply
      reserve
      tokenPriceUSD
      pool {
        id
        reserve
        reserveUSD
        token {
          id
        }
      }
    }
  }
`

export const USER_POSITIONS = gql`
  query liquidityPositions($user: Bytes!) {
    liquidityPositions(where: { user: $user }) {
      pool {
        id
        reserve
        reserveUSD
        token {
          id
          symbol
          derivedETH
        }
        totalSupply
      }
      liquidityTokenBalance
    }
  }
`

export const USER_TRANSACTIONS = gql`
  query transactions($user: Bytes!) {
    mints(orderBy: timestamp, orderDirection: desc, where: { to: $user }) {
      id
      transaction {
        id
        timestamp
      }
      pool {
        id
        token {
          id
          symbol
        }
      }
      to
      liquidity
      amount
      amountUSD
    }
    burns(orderBy: timestamp, orderDirection: desc, where: { sender: $user }) {
      id
      transaction {
        id
        timestamp
      }
      pool {
        id
        token {
          id
          symbol
        }
      }
      sender
      to
      liquidity
      amount
      amountUSD
    }
    flashLoans(orderBy: timestamp, orderDirection: desc, where: { from: $user }) {
      id
      transaction {
        id
        timestamp
      }
      pool {
        token {
          id
          symbol
        }
      }
      target
      initiator
      asset {
        id
        symbol
      }
      amount
      premium
      amountUSD
    }
  }
`

export const POOL_CHART = gql`
  query poolDayDatas($poolAddress: Bytes!, $skip: Int!) {
    poolDayDatas(first: 1000, skip: $skip, orderBy: date, orderDirection: asc, where: { poolAddress: $poolAddress }) {
      id
      date
      dailyVolumeToken
      dailyVolumeUSD
      reserveUSD
    }
  }
`

export const POOL_DAY_DATA = gql`
  query poolDayDatas($poolAddress: Bytes!, $date: Int!) {
    poolDayDatas(first: 1, orderBy: date, orderDirection: desc, where: { poolAddress: $poolAddress, date_lt: $date }) {
      id
      date
      dailyVolumeToken
      dailyVolumeUSD
      totalSupply
      reserveUSD
    }
  }
`

export const POOL_DAY_DATA_BULK = (pools, startTimestamp) => {
  let poolsString = `[`
  pools.map((pool) => {
    return (poolsString += `"${pool}"`)
  })
  poolsString += ']'
  const queryString = `
    query days {
      poolDayDatas(first: 1000, orderBy: date, orderDirection: asc, where: { poolAddress_in: ${poolsString}, date_gt: ${startTimestamp} }) {
        id
        poolAddress
        date
        dailyVolumeToken
        dailyVolumeUSD
        totalSupply
        reserveUSD
      }
    } 
`
  return gql(queryString)
}

export const GLOBAL_CHART = gql`
  query flashLoanDayDatas($startTime: Int!, $skip: Int!) {
    flashLoanDayDatas(first: 1000, skip: $skip, where: { date_gt: $startTime }, orderBy: date, orderDirection: asc) {
      id
      date
      totalVolumeUSD
      dailyVolumeUSD
      dailyVolumeETH
      totalLiquidityUSD
      totalLiquidityETH
    }
  }
`

export const GLOBAL_DATA = (block) => {
  const queryString = ` query flashLoanFactories {
      flashLoanFactories(
       ${block ? `block: { number: ${block}}` : ``} 
       where: { id: "${FACTORY_ADDRESS}" }) {
        id
        totalVolumeUSD
        totalVolumeETH
        untrackedVolumeUSD
        totalLiquidityUSD
        totalLiquidityETH
        txCount
        poolCount
      }
    }`
  return gql(queryString)
}

export const GLOBAL_TXNS = gql`
  query transactions {
    transactions(first: 100, orderBy: timestamp, orderDirection: desc) {
      mints(orderBy: timestamp, orderDirection: desc) {
        transaction {
          id
          timestamp
        }
        pool {
          token {
            id
            symbol
          }
        }
        to
        liquidity
        amount
        amountUSD
      }
      burns(orderBy: timestamp, orderDirection: desc) {
        transaction {
          id
          timestamp
        }
        pool {
          token {
            id
            symbol
          }
        }
        sender
        liquidity
        amount
        amountUSD
      }
      flashLoans(orderBy: timestamp, orderDirection: desc) {
        transaction {
          id
          timestamp
        }
        pool {
          token {
            id
            symbol
          }
        }
        target
        initiator
        asset
        amount
        premium
        amountUSD
      }
    }
  }
`

export const ALL_TOKENS = gql`
  query tokens($skip: Int!) {
    tokens(first: 500, skip: $skip) {
      id
      name
      symbol
      totalLiquidity
    }
  }
`

export const TOKEN_SEARCH = gql`
  query tokens($value: String, $id: String) {
    asSymbol: tokens(where: { symbol_contains: $value }, orderBy: totalLiquidity, orderDirection: desc) {
      id
      symbol
      name
      totalLiquidity
    }
    asName: tokens(where: { name_contains: $value }, orderBy: totalLiquidity, orderDirection: desc) {
      id
      symbol
      name
      totalLiquidity
    }
    asAddress: tokens(where: { id: $id }, orderBy: totalLiquidity, orderDirection: desc) {
      id
      symbol
      name
      totalLiquidity
    }
  }
`

export const POOL_SEARCH = gql`
  query pools($tokens: [Bytes]!, $id: String) {
    asTokenAddress: pools(where: { token_in: $tokens }) {
      id
      token {
        id
        symbol
        name
      }
    }
    asAddress: pools(where: { id: $id }) {
      id
      token {
        id
        symbol
        name
      }
    }
  }
`

export const ALL_POOLS = gql`
  query pools($skip: Int!) {
    pools(first: 500, skip: $skip, orderBy: trackedReserveETH, orderDirection: desc) {
      id
      token {
        id
        symbol
        name
      }
    }
  }
`

const PoolFields = `
  fragment PoolFields on Pool {
    id
    txCount
    token {
      id
      symbol
      name
      totalLiquidity
      derivedETH
    }
    reserve
    reserveUSD
    totalSupply
    trackedReserveETH
    reserveETH
    volumeUSD
    untrackedVolumeUSD
    tokenPrice
    createdAtTimestamp
  }
`

export const POOLS_CURRENT = gql`
  query pools {
    pools(first: 200, orderBy: trackedReserveETH, orderDirection: desc) {
      id
    }
  }
`

export const POOL_DATA = (poolAddress, block) => {
  const queryString = `
    ${PoolFields}
    query pools {
      pools(${block ? `block: {number: ${block}}` : ``} where: { id: "${poolAddress}"} ) {
        ...PoolFields
      }
    }`
  return gql(queryString)
}

export const MINING_POSITIONS = (account) => {
  const queryString = `
    query users {
      user(id: "${account}") {
        miningPosition {
          id
          user {
            id
          }
          miningPool {
              pool {
                id
                token
              }
          }
          balance
        }
      }
    }
`
  return gql(queryString)
}

export const POOLS_BULK = gql`
  ${PoolFields}
  query pools($allPools: [Bytes]!) {
    pools(where: { id_in: $allPools }, orderBy: trackedReserveETH, orderDirection: desc) {
      ...PoolFields
    }
  }
`

export const POOLS_HISTORICAL_BULK = (block, pools) => {
  let poolsString = `[`
  pools.map((pool) => {
    return (poolsString += `"${pool}"`)
  })
  poolsString += ']'
  let queryString = `
  query pools {
    pools(first: 200, where: {id_in: ${poolsString}}, block: {number: ${block}}, orderBy: trackedReserveETH, orderDirection: desc) {
      id
      reserveUSD
      trackedReserveETH
      volumeUSD
      untrackedVolumeUSD
    }
  }
  `
  return gql(queryString)
}

export const TOKEN_CHART = gql`
  query tokenDayDatas($tokenAddr: String!, $skip: Int!) {
    tokenDayDatas(first: 1000, skip: $skip, orderBy: date, orderDirection: asc, where: { token: $tokenAddr }) {
      id
      date
      priceUSD
      totalLiquidityToken
      totalLiquidityUSD
      totalLiquidityETH
      dailyVolumeETH
      dailyVolumeToken
      dailyVolumeUSD
      mostLiquidPools {
        id
        token {
          id
          derivedETH
        }
      }
    }
  }
`

const TokenFields = `
  fragment TokenFields on Token {
    id
    name
    symbol
    derivedETH
    tradeVolume
    tradeVolumeUSD
    untrackedVolumeUSD
    totalLiquidity
    txCount
  }
`

export const TOKENS_CURRENT = gql`
  ${TokenFields}
  query tokens {
    tokens(first: 200, orderBy: tradeVolumeUSD, orderDirection: desc) {
      ...TokenFields
    }
  }
`

export const TOKENS_DYNAMIC = (block) => {
  const queryString = `
    ${TokenFields}
    query tokens {
      tokens(block: {number: ${block}} first: 200, orderBy: tradeVolumeUSD, orderDirection: desc) {
        ...TokenFields
      }
    }
  `
  return gql(queryString)
}

export const TOKEN_DATA = (tokenAddress, block) => {
  const queryString = `
    ${TokenFields}
    query tokens {
      tokens(${block ? `block : {number: ${block}}` : ``} where: {id:"${tokenAddress}"}) {
        ...TokenFields
      }
      pools: pools(where: {token: "${tokenAddress}"}, first: 50, orderBy: reserveUSD, orderDirection: desc){
        id
      }
    }
  `
  return gql(queryString)
}

export const FILTERED_TRANSACTIONS = gql`
  query($allPools: [Bytes]!) {
    mints(first: 20, where: { pool_in: $allPools }, orderBy: timestamp, orderDirection: desc) {
      transaction {
        id
        timestamp
      }
      pool {
        token {
          id
          symbol
        }
      }
      to
      liquidity
      amount
      amountUSD
    }
    burns(first: 20, where: { pool_in: $allPools }, orderBy: timestamp, orderDirection: desc) {
      transaction {
        id
        timestamp
      }
      pool {
        token {
          id
          symbol
        }
      }
      sender
      liquidity
      amount
      amountUSD
    }
    flashLoans(first: 30, where: { pool_in: $allPools }, orderBy: timestamp, orderDirection: desc) {
      transaction {
        id
        timestamp
      }
      id
      pool {
        token {
          id
          symbol
        }
      }
      target
      initiator
      asset {
        id
        symbol
      }
      amount
      premium
      amountUSD
    }
  }
`
