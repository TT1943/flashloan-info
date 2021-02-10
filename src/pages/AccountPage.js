import React, { useState, useMemo, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { useUserTransactions, useUserPositions, useMiningPositions } from '../contexts/User'
import TxnList from '../components/TxnList'
import Panel from '../components/Panel'
import { formattedNum } from '../utils'
import Row, { AutoRow, RowFixed, RowBetween } from '../components/Row'
import { AutoColumn } from '../components/Column'
import UserChart from '../components/UserChart'
import PoolReturnsChart from '../components/PoolReturnsChart'
import PositionList from '../components/PositionList'
import MiningPositionList from '../components/MiningPositionList'
import { TYPE } from '../Theme'
import { ButtonDropdown, ButtonLight } from '../components/ButtonStyled'
import { PageWrapper, ContentWrapper, StyledIcon } from '../components'
import TokenLogo from '../components/TokenLogo'
import { Bookmark, Activity } from 'react-feather'
import Link from '../components/Link'
import { FEE_WARNING_TOKENS } from '../constants'
import { BasicLink } from '../components/Link'
import { useMedia } from 'react-use'
import Search from '../components/Search'
import { useSavedAccounts } from '../contexts/LocalStorage'

const AccountWrapper = styled.div`
  background-color: rgba(255, 255, 255, 0.2);
  padding: 6px 16px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const Header = styled.div``

const DashboardWrapper = styled.div`
  width: 100%;
`

const DropdownWrapper = styled.div`
  position: relative;
  margin-bottom: 1rem;
  border: 1px solid #edeef2;
  border-radius: 12px;
`

const Flyout = styled.div`
  position: absolute;
  top: 38px;
  left: -1px;
  width: 100%;
  background-color: ${({ theme }) => theme.bg1};
  z-index: 999;
  border-bottom-right-radius: 10px;
  border-bottom-left-radius: 10px;
  padding-top: 4px;
  border: 1px solid #edeef2;
  border-top: none;
`

const MenuRow = styled(Row)`
  width: 100%;
  padding: 12px 0;
  padding-left: 12px;

  :hover {
    cursor: pointer;
    background-color: ${({ theme }) => theme.bg2};
  }
`

const PanelWrapper = styled.div`
  grid-template-columns: 1fr;
  grid-template-rows: max-content;
  gap: 6px;
  display: inline-grid;
  width: 100%;
  align-items: start;
`

const Warning = styled.div`
  background-color: ${({ theme }) => theme.bg2};
  color: ${({ theme }) => theme.text1};
  padding: 1rem;
  font-weight: 600;
  border-radius: 10px;
  margin-bottom: 1rem;
  width: calc(100% - 2rem);
`

function AccountPage({ account }) {
  // get data for this account
  const transactions = useUserTransactions(account)
  const positions = useUserPositions(account)
  const miningPositions = useMiningPositions(account)

  // get data for user stats
  const transactionCount = transactions?.flashLoans?.length + transactions?.burns?.length + transactions?.mints?.length

  // get derived totals
  let totalFlashLoanedUSD = useMemo(() => {
    return transactions?.flashLoans
      ? transactions?.flashLoans.reduce((total, flashLoan) => {
        return total + parseFloat(flashLoan.amountUSD)
      }, 0)
      : 0
  }, [transactions])

  // if any position has token from fee warning list, show warning
  const [showWarning, setShowWarning] = useState(false)
  useEffect(() => {
    if (positions) {
      for (let i = 0; i < positions.length; i++) {
        if (
          FEE_WARNING_TOKENS.includes(positions[i].pool.token.id)
        ) {
          setShowWarning(true)
        }
      }
    }
  }, [positions])

  // settings for list view and dropdowns
  const hideLPContent = positions && positions.length === 0
  const [showDropdown, setShowDropdown] = useState(false)
  const [activePosition, setActivePosition] = useState()

  const dynamicPositions = activePosition ? [activePosition] : positions

  const aggregateFees = dynamicPositions?.reduce(function (total, position) {
    return total + position.fees.sum
  }, 0)

  const positionValue = useMemo(() => {
    return dynamicPositions
      ? dynamicPositions.reduce((total, position) => {
        return (
          total +
          (parseFloat(position?.liquidityTokenBalance) / parseFloat(position?.pool?.totalSupply)) *
          position?.pool?.reserveUSD
        )
      }, 0)
      : null
  }, [dynamicPositions])

  useEffect(() => {
    window.scrollTo({
      behavior: 'smooth',
      top: 0,
    })
  }, [])

  const below600 = useMedia('(max-width: 600px)')

  // adding/removing account from saved accounts
  const [savedAccounts, addAccount, removeAccount] = useSavedAccounts()
  const isBookmarked = savedAccounts.includes(account)
  const handleBookmarkClick = useCallback(() => {
    ; (isBookmarked ? removeAccount : addAccount)(account)
  }, [account, isBookmarked, addAccount, removeAccount])

  return (
    <PageWrapper>
      <ContentWrapper>
        <RowBetween>
          <TYPE.body>
            <BasicLink to="/accounts">{'Accounts '}</BasicLink>→{' '}
            <Link lineHeight={'145.23%'} href={'https://etherscan.io/address/' + account} target="_blank">
              {' '}
              {account?.slice(0, 42)}{' '}
            </Link>
          </TYPE.body>
          {!below600 && <Search small={true} />}
        </RowBetween>
        <Header>
          <RowBetween>
            <span>
              <TYPE.header fontSize={24}>{account?.slice(0, 6) + '...' + account?.slice(38, 42)}</TYPE.header>
              <Link lineHeight={'145.23%'} href={'https://etherscan.io/address/' + account} target="_blank">
                <TYPE.main fontSize={14}>View on Etherscan</TYPE.main>
              </Link>
            </span>
            <AccountWrapper>
              <StyledIcon>
                <Bookmark
                  onClick={handleBookmarkClick}
                  style={{ opacity: isBookmarked ? 0.8 : 0.4, cursor: 'pointer' }}
                />
              </StyledIcon>
            </AccountWrapper>
          </RowBetween>
        </Header>
        <DashboardWrapper>
          {showWarning && <Warning>Fees cannot currently be calculated for pools that include AMPL.</Warning>}
          {!hideLPContent && (
            <DropdownWrapper>
              <ButtonDropdown width="100%" onClick={() => setShowDropdown(!showDropdown)} open={showDropdown}>
                {!activePosition && (
                  <RowFixed>
                    <StyledIcon>
                      <Activity size={16} />
                    </StyledIcon>
                    <TYPE.body ml={'10px'}>All Positions</TYPE.body>
                  </RowFixed>
                )}
                {activePosition && (
                  <RowFixed>
                    <TokenLogo address={activePosition.pool.token.id} size={'16px'} />
                    <TYPE.body ml={'16px'}>
                      {activePosition.pool.token.symbol} Pool Position
                    </TYPE.body>
                  </RowFixed>
                )}
              </ButtonDropdown>
              {showDropdown && (
                <Flyout>
                  <AutoColumn gap="0px">
                    {positions?.map((p, i) => {
                      if (p.pool.token.symbol === 'WETH') {
                        p.pool.token.symbol = 'ETH'
                      }
                      return (
                        p.pool.id !== activePosition?.pool.id && (
                          <MenuRow
                            onClick={() => {
                              setActivePosition(p)
                              setShowDropdown(false)
                            }}
                            key={i}
                          >
                            <TokenLogo address={p.pool.token.id} size={16} />
                            <TYPE.body ml={'16px'}>
                              {p.pool.token.symbol} Position
                            </TYPE.body>
                          </MenuRow>
                        )
                      )
                    })}
                    {activePosition && (
                      <MenuRow
                        onClick={() => {
                          setActivePosition()
                          setShowDropdown(false)
                        }}
                      >
                        <RowFixed>
                          <StyledIcon>
                            <Activity size={16} />
                          </StyledIcon>
                          <TYPE.body ml={'10px'}>All Positions</TYPE.body>
                        </RowFixed>
                      </MenuRow>
                    )}
                  </AutoColumn>
                </Flyout>
              )}
            </DropdownWrapper>
          )}
          {!hideLPContent && (
            <Panel style={{ height: '100%', marginBottom: '1rem' }}>
              <AutoRow gap="20px">
                <AutoColumn gap="10px">
                  <RowBetween>
                    <TYPE.body>Liquidity (Including Fees)</TYPE.body>
                    <div />
                  </RowBetween>
                  <RowFixed align="flex-end">
                    <TYPE.header fontSize={'24px'} lineHeight={1}>
                      {positionValue
                        ? formattedNum(positionValue, true)
                        : positionValue === 0
                        ? formattedNum(0, true)
                        : '-'}
                    </TYPE.header>
                  </RowFixed>
                </AutoColumn>
                <AutoColumn gap="10px">
                  <RowBetween>
                    <TYPE.body>Fees Earned (Cumulative)</TYPE.body>
                    <div />
                  </RowBetween>
                  <RowFixed align="flex-end">
                    <TYPE.header fontSize={'24px'} lineHeight={1} color={aggregateFees && 'green'}>
                      {aggregateFees ? formattedNum(aggregateFees, true, true) : '-'}
                    </TYPE.header>
                  </RowFixed>
                </AutoColumn>
              </AutoRow>
            </Panel>
          )}
          {!hideLPContent && (
            <PanelWrapper>
              <Panel style={{ gridColumn: '1' }}>
                {activePosition ? (
                  <PoolReturnsChart account={account} position={activePosition} />
                ) : (
                  <UserChart account={account} position={activePosition} />
                )}
              </Panel>
            </PanelWrapper>
          )}
          <TYPE.main fontSize={'1.125rem'} style={{ marginTop: '3rem' }}>
            Positions
          </TYPE.main>{' '}
          <Panel
            style={{
              marginTop: '1.5rem',
            }}
          >
            <PositionList positions={positions} />
          </Panel>
          <TYPE.main fontSize={'1.125rem'} style={{ marginTop: '3rem' }}>
            Liquidity Mining Pools
          </TYPE.main>
          <Panel
            style={{
              marginTop: '1.5rem',
            }}
          >
            {miningPositions && <MiningPositionList miningPositions={miningPositions} />}
            {!miningPositions && (
              <AutoColumn gap="8px" justify="flex-start">
                <TYPE.main>No Staked Liquidity.</TYPE.main>
                <AutoRow gap="8px" justify="flex-start">
                  <ButtonLight style={{ padding: '4px 6px', borderRadius: '4px' }}>Learn More</ButtonLight>{' '}
                </AutoRow>{' '}
              </AutoColumn>
            )}
          </Panel>
          <TYPE.main fontSize={'1.125rem'} style={{ marginTop: '3rem' }}>
            Transactions
          </TYPE.main>{' '}
          <Panel
            style={{
              marginTop: '1.5rem',
            }}
          >
            <TxnList transactions={transactions} />
          </Panel>
          <TYPE.main fontSize={'1.125rem'} style={{ marginTop: '3rem' }}>
            Wallet Stats
          </TYPE.main>{' '}
          <Panel
            style={{
              marginTop: '1.5rem',
            }}
          >
            <AutoRow gap="20px">
              <AutoColumn gap="8px">
                <TYPE.header fontSize={24}>{totalFlashLoanedUSD ? formattedNum(totalFlashLoanedUSD, true) : '-'}</TYPE.header>
                <TYPE.main>Total Flash Loan Value</TYPE.main>
              </AutoColumn>
              <AutoColumn gap="8px">
                <TYPE.header fontSize={24}>
                  {totalFlashLoanedUSD ? formattedNum(totalFlashLoanedUSD * 0.0005, true) : '-'}
                </TYPE.header>
                <TYPE.main>Total Fees Paid</TYPE.main>
              </AutoColumn>
              <AutoColumn gap="8px">
                <TYPE.header fontSize={24}>{transactionCount ? transactionCount : '-'}</TYPE.header>
                <TYPE.main>Total Transactions</TYPE.main>
              </AutoColumn>
            </AutoRow>
          </Panel>
        </DashboardWrapper>
      </ContentWrapper>
    </PageWrapper>
  )
}

export default AccountPage
