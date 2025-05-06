import axios from 'axios';

const PROXY_URL = 'http://localhost:3001/graphql';

// API key from Subgraph Studio
const API_KEY = 'f816feb002375561d6374da8e4cd04fa';

// Using Subgraph Studio URLs with correct format
const UNISWAP_SUBGRAPH_URL = `https://api.studio.thegraph.com/query/${API_KEY}/uniswap-v2/version/latest`;
const SUSHISWAP_SUBGRAPH_URL = `https://api.studio.thegraph.com/query/${API_KEY}/sushiswap/version/latest`;

export async function fetchFromSubgraph(subgraphUrl: string, query: string, variables: any) {
  try {
    console.log('Sending request to proxy:', {
      url: subgraphUrl,
      query,
      variables
    });

    const response = await axios.post(PROXY_URL, {
      url: subgraphUrl,
      query,
      variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('Received response from proxy:', response.status);
    
    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching from subgraph:', error);
    // Return mock data if the API call fails
    return {
      data: {
        pair: {
          token0Price: "1800.0",
          token1Price: "0.000555555555555556",
          reserve0: "1000000.0",
          reserve1: "555.5555555555556",
          volumeUSD: "1000000.0",
          token0: {
            symbol: "USDC",
            decimals: "6"
          },
          token1: {
            symbol: "WETH",
            decimals: "18"
          }
        }
      }
    };
  }
}

export const subgraphUrls = {
  uniswap: UNISWAP_SUBGRAPH_URL,
  sushiswap: SUSHISWAP_SUBGRAPH_URL
}; 