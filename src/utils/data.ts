interface BasicData {
  token?: {
    id: string
    name: string
    symbol: string
  }
}

// Override data return from graph - usually because proxy token has changed
// names since entitiy was created in subgraph
// keys are lowercase token addresses <--------
const TOKEN_OVERRIDES: { [address: string]: { name: string; symbol: string } } = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    name: 'Ether (Wrapped)',
    symbol: 'ETH',
  },
  '0xd0a1e359811322d97991e03f863a0c30c2cf029c': {
    name: 'Ether (Wrapped)',
    symbol: 'ETH',
  },
  '0x1416946162b1c2c871a73b07e932d2fb6c932069': {
    name: 'Energi',
    symbol: 'NRGE',
  },
}

// override tokens with incorrect symbol or names
export function updateNameData(data: BasicData): BasicData | undefined {
  if (data?.token?.id && Object.keys(TOKEN_OVERRIDES).includes(data.token.id)) {
    data.token.name = TOKEN_OVERRIDES[data.token.id].name
    data.token.symbol = TOKEN_OVERRIDES[data.token.id].symbol
  }

  return data
}
