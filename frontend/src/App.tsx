import { useState, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Input,
  FormControl,
  FormLabel,
  useToast,
  Badge,
  Grid,
  GridItem,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  SimpleGrid,
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import FlashloanArbitrage from './contracts/FlashloanArbitrage.json';
import { PriceMonitor } from './services/priceMonitor';

// Add type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

// Contract addresses from our local deployment
const CONTRACT_ADDRESS = "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";
const USDC_ADDRESS = "0x67d269191c92Caf3cD7723F116c85e6E9bf55933";
const WETH_ADDRESS = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
const USDT_ADDRESS = "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690";

function App() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [amount, setAmount] = useState<string>("1000");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [trades, setTrades] = useState<Array<{ token: string; amount: string; profit: string; timestamp: Date }>>([]);
  const [priceMonitor, setPriceMonitor] = useState<PriceMonitor | null>(null);
  const [arbitrageOpportunity, setArbitrageOpportunity] = useState<{
    profitable: boolean;
    profit: number;
    details: string;
  } | null>(null);
  const [arbitrageDetails, setArbitrageDetails] = useState<string>("");
  const [prices, setPrices] = useState<{
    uniswap: { usdcWeth: number; wethUsdt: number };
    sushiswap: { usdcWeth: number; wethUsdt: number };
    lastPrices?: {
      uniswap: { usdcWeth: number; wethUsdt: number };
      sushiswap: { usdcWeth: number; wethUsdt: number };
    };
  } | null>(null);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    let contractInstance: ethers.Contract | null = null;

    const init = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);

        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const signer = provider.getSigner();
          setSigner(signer);

          contractInstance = new ethers.Contract(
            CONTRACT_ADDRESS,
            FlashloanArbitrage.abi,
            signer
          );
          setContract(contractInstance);

          // Initialize price monitor
          const monitor = new PriceMonitor(provider);
          setPriceMonitor(monitor);

          // Listen for ArbitrageExecuted events
          contractInstance.on("ArbitrageExecuted", (token, amount, profit, event) => {
            if (mounted) {
              const trade = {
                token,
                amount: ethers.utils.formatUnits(amount, 6),
                profit: ethers.utils.formatUnits(profit, 6),
                timestamp: new Date()
              };
              setTrades(prev => [trade, ...prev]);
            }
          });
        } catch (error) {
          console.error("Error connecting to wallet:", error);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (contractInstance) {
        contractInstance.removeAllListeners("ArbitrageExecuted");
      }
    };
  }, []);

  // Monitor prices and check for arbitrage opportunities
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkArbitrage = async () => {
      if (priceMonitor && amount) {
        try {
          const opportunity = await priceMonitor.calculateArbitrageOpportunity(parseFloat(amount));
          setArbitrageOpportunity(opportunity);
          setArbitrageDetails(opportunity.details);
          
          // Get current prices
          const currentPrices = await priceMonitor.getPrices();
          setPrices(prev => ({
            ...currentPrices,
            lastPrices: prev ? {
              uniswap: prev.uniswap,
              sushiswap: prev.sushiswap
            } : undefined
          }));
        } catch (error) {
          console.error('Error checking arbitrage:', error);
        }
      }
    };

    if (priceMonitor) {
      checkArbitrage();
      intervalId = setInterval(checkArbitrage, 10000); // Check every 10 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [priceMonitor, amount]);

  const executeArbitrage = async () => {
    if (!contract || !signer) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!arbitrageOpportunity?.profitable) {
      toast({
        title: "Warning",
        description: "No profitable arbitrage opportunity found",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoading(true);
      const amountWei = ethers.utils.parseUnits(amount, 6);
      const path1 = [USDC_ADDRESS, WETH_ADDRESS, USDT_ADDRESS];
      const path2 = [USDT_ADDRESS, WETH_ADDRESS, USDC_ADDRESS];

      const tx = await contract.executeArbitrage(
        USDC_ADDRESS,
        amountWei,
        path1,
        path2
      );

      await tx.wait();

      toast({
        title: "Success",
        description: "Arbitrage executed successfully!",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error executing arbitrage:", error);
      toast({
        title: "Error",
        description: "Failed to execute arbitrage",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChakraProvider>
      <Box p={8} maxW="1200px" mx="auto">
        <VStack spacing={8} align="stretch">
          <Heading textAlign="center" mb={8}>Flash Loan Arbitrage Bot</Heading>
          
          {/* Price Monitoring Section */}
          <Card>
            <CardHeader>
              <Heading size="md">Real-time Price Monitoring</Heading>
              <Text fontSize="sm" color="gray.500">Updates every 10 seconds</Text>
            </CardHeader>
            <CardBody>
              {prices && (
                <Box>
                  <Heading size="md" mb={4}>Uniswap Prices</Heading>
                  <SimpleGrid columns={2} spacing={4}>
                    <Stat>
                      <StatLabel>USDC/WETH</StatLabel>
                      <StatNumber>{prices.uniswap.usdcWeth.toFixed(6)}</StatNumber>
                      {prices.lastPrices && (
                        <StatHelpText>
                          <StatArrow 
                            type={prices.uniswap.usdcWeth > prices.lastPrices.uniswap.usdcWeth ? "increase" : "decrease"} 
                          />
                          {Math.abs(prices.uniswap.usdcWeth - prices.lastPrices.uniswap.usdcWeth).toFixed(6)}
                        </StatHelpText>
                      )}
                    </Stat>
                    <Stat>
                      <StatLabel>WETH/USDT</StatLabel>
                      <StatNumber>{prices.uniswap.wethUsdt.toFixed(2)}</StatNumber>
                      {prices.lastPrices && (
                        <StatHelpText>
                          <StatArrow 
                            type={prices.uniswap.wethUsdt > prices.lastPrices.uniswap.wethUsdt ? "increase" : "decrease"} 
                          />
                          {Math.abs(prices.uniswap.wethUsdt - prices.lastPrices.uniswap.wethUsdt).toFixed(2)}
                        </StatHelpText>
                      )}
                    </Stat>
                  </SimpleGrid>
                </Box>
              )}
              {prices && (
                <Box p={4} borderWidth="1px" borderRadius="lg">
                  <Heading size="md" mb={4}>SushiSwap Prices</Heading>
                  <SimpleGrid columns={2} spacing={4}>
                    <Stat>
                      <StatLabel>USDC/WETH</StatLabel>
                      <StatNumber>{prices.sushiswap.usdcWeth.toFixed(6)}</StatNumber>
                      {prices.lastPrices && (
                        <StatHelpText>
                          <StatArrow 
                            type={prices.sushiswap.usdcWeth > prices.lastPrices.sushiswap.usdcWeth ? "increase" : "decrease"} 
                          />
                          {Math.abs(prices.sushiswap.usdcWeth - prices.lastPrices.sushiswap.usdcWeth).toFixed(6)}
                        </StatHelpText>
                      )}
                    </Stat>
                    <Stat>
                      <StatLabel>WETH/USDT</StatLabel>
                      <StatNumber>{prices.sushiswap.wethUsdt.toFixed(2)}</StatNumber>
                      {prices.lastPrices && (
                        <StatHelpText>
                          <StatArrow 
                            type={prices.sushiswap.wethUsdt > prices.lastPrices.sushiswap.wethUsdt ? "increase" : "decrease"} 
                          />
                          {Math.abs(prices.sushiswap.wethUsdt - prices.lastPrices.sushiswap.wethUsdt).toFixed(2)}
                        </StatHelpText>
                      )}
                    </Stat>
                  </SimpleGrid>
                </Box>
              )}
            </CardBody>
          </Card>

          {/* Arbitrage Opportunity Section */}
          <Card>
            <CardHeader>
              <Heading size="md">Arbitrage Opportunities</Heading>
              <Text fontSize="sm" color="gray.500">Analyzing both trading paths</Text>
            </CardHeader>
            <CardBody>
              <FormControl mb={6}>
                <FormLabel>Amount to Trade (USDC)</FormLabel>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount in USDC"
                />
              </FormControl>

              {arbitrageOpportunity && (
                <VStack spacing={4} align="stretch">
                  <Box p={4} borderWidth="1px" borderRadius="md" bg={arbitrageOpportunity.profitable ? "green.50" : "red.50"}>
                    <Badge colorScheme={arbitrageOpportunity.profitable ? "green" : "red"} mb={2}>
                      {arbitrageOpportunity.profitable ? "Profitable Opportunity Found!" : "No Profitable Opportunity"}
                    </Badge>
                    <Text fontWeight="bold" fontSize="xl">
                      Expected Profit: {arbitrageOpportunity.profit.toFixed(2)} USDC
                    </Text>
                  </Box>

                  <Box>
                    <Heading size="sm" mb={2}>Trading Paths Analysis</Heading>
                    <Box p={4} bg="gray.50" borderRadius="md">
                      <Text whiteSpace="pre-wrap" fontSize="sm">
                        {arbitrageDetails}
                      </Text>
                    </Box>
                  </Box>

                  <Button
                    colorScheme="blue"
                    onClick={executeArbitrage}
                    isLoading={isLoading}
                    loadingText="Executing..."
                    isDisabled={!arbitrageOpportunity.profitable}
                    size="lg"
                    width="100%"
                  >
                    Execute Arbitrage
                  </Button>
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Recent Trades Section */}
          <Card>
            <CardHeader>
              <Heading size="md">Recent Trades</Heading>
            </CardHeader>
            <CardBody>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th>Token</Th>
                    <Th isNumeric>Amount</Th>
                    <Th isNumeric>Profit</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {trades.map((trade, index) => (
                    <Tr key={index}>
                      <Td>{trade.timestamp.toLocaleTimeString()}</Td>
                      <Td>{trade.token}</Td>
                      <Td isNumeric>{trade.amount} USDC</Td>
                      <Td isNumeric color={parseFloat(trade.profit) > 0 ? "green.500" : "red.500"}>
                        {trade.profit} USDC
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </ChakraProvider>
  );
}

export default App;
