import React, { useEffect, useState } from 'react';
import { Web3Provider } from '@ethersproject/providers';
import { DexMonitor } from './services/DexMonitor';
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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';

function App() {
  const [dexMonitor, setDexMonitor] = useState<DexMonitor | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [useOptimalAmount, setUseOptimalAmount] = useState<boolean>(true);
  const [prices, setPrices] = useState<{ [key: string]: any }>({});
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const toast = useToast();

  useEffect(() => {
    const connectWallet = async () => {
      try {
        if (window.ethereum) {
          const provider = new Web3Provider(window.ethereum);
          
          // Request account access
          await provider.send('eth_requestAccounts', []);
          
          // Check if we're on Polygon network
          const network = await provider.getNetwork();
          if (network.chainId !== 137) { // Polygon mainnet chainId
            try {
              // Try to switch to Polygon
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // 137 in hex
              });
            } catch (switchError: any) {
              // If Polygon is not added to MetaMask, add it
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x89',
                    chainName: 'Polygon Mainnet',
                    nativeCurrency: {
                      name: 'MATIC',
                      symbol: 'MATIC',
                      decimals: 18
                    },
                    rpcUrls: ['https://polygon-rpc.com'],
                    blockExplorerUrls: ['https://polygonscan.com']
                  }]
                });
              } else {
                throw switchError;
              }
            }
          }

          const monitor = await DexMonitor.create(provider);
          setDexMonitor(monitor);
          setIsConnected(true);
          toast({
            title: 'Connected',
            description: 'Successfully connected to Polygon network',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        } else {
          // If no MetaMask, use public RPC
          const monitor = await DexMonitor.create();
          setDexMonitor(monitor);
          setIsConnected(true);
          toast({
            title: 'Connected',
            description: 'Using Polygon public RPC endpoint',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
        toast({
          title: 'Error',
          description: 'Failed to connect wallet',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    connectWallet();
  }, [toast]);

  useEffect(() => {
    if (!dexMonitor) return;

    const checkPrices = async () => {
      try {
        if (useOptimalAmount) {
          console.log('Finding optimal arbitrage opportunities...');
          const opportunities = await dexMonitor.findArbitrageOpportunities();
          console.log('Found opportunities:', opportunities);
          setOpportunities(opportunities);
        } else {
          const amountNumber = parseFloat(amount);
          if (isNaN(amountNumber) || amountNumber <= 0) {
            console.log('Invalid amount, skipping price check');
            return;
          }
          console.log('Checking prices with amount:', amountNumber);
          const opportunities = await dexMonitor.findArbitrageOpportunities(amountNumber);
          console.log('Found opportunities:', opportunities);
          setOpportunities(opportunities);
        }
      } catch (error) {
        console.error('Error checking prices:', error);
        toast({
          title: "Error",
          description: "Failed to fetch prices",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    };

    const interval = setInterval(checkPrices, 10000);
    checkPrices(); // Initial check

    return () => clearInterval(interval);
  }, [dexMonitor, amount, useOptimalAmount, toast]);

  const renderOpportunities = () => {
    if (!opportunities.length) {
      return (
        <Box p={4} textAlign="center" bg="gray.50" borderRadius="md">
          <Text color="gray.500">No opportunities found</Text>
        </Box>
      );
    }

    const profitableOpps = opportunities.filter(opp => opp.opportunity.profitable);
    const nonProfitableOpps = opportunities.filter(opp => !opp.opportunity.profitable);

    return (
      <VStack spacing={6} align="stretch">
        {profitableOpps.length > 0 && (
          <Box>
            <Heading size="md" mb={4} color="green.600">
              Profitable Opportunities ({profitableOpps.length})
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              {profitableOpps.map((opp, index) => (
                <Box
                  key={index}
                  p={4}
                  bg="green.50"
                  borderWidth="1px"
                  borderColor="green.200"
                  borderRadius="lg"
                  boxShadow="sm"
                >
                  <Flex justify="space-between" align="start" mb={4}>
                    <Box>
                      <Heading size="sm" color="green.700">{opp.pairKey}</Heading>
                      <Text fontSize="sm" color="gray.600">Amount: {opp.amount} USDC</Text>
                    </Box>
                    <Box textAlign="right">
                      <Text fontSize="xl" fontWeight="bold" color="green.600">
                        +{opp.details.profitPercentage.toFixed(4)}%
                      </Text>
                      <Text fontSize="sm" color="green.600">
                        +{opp.opportunity.profit.toFixed(6)} USDC
                      </Text>
                    </Box>
                  </Flex>

                  <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
                    <Box>
                      <Text fontWeight="medium" mb={2}>Price Impact</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">
                          Quickswap: {(opp.details.priceImpact.quickswap * 100).toFixed(4)}%
                        </Text>
                        <Text fontSize="sm">
                          Sushiswap: {(opp.details.priceImpact.sushiswap * 100).toFixed(4)}%
                        </Text>
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="medium" mb={2}>Costs</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">Fees: {opp.details.fees.toFixed(6)} USDC</Text>
                        <Text fontSize="sm">Gas: {opp.details.gasCost.toFixed(6)} MATIC</Text>
                      </VStack>
                    </Box>
                  </Grid>

                  <Box>
                    <Text fontWeight="medium" mb={2}>Conditions</Text>
                    <SimpleGrid columns={2} spacing={2}>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.profitPositive ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.profitPositive ? "✓" : "✗"} Profit Positive
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.feesAcceptable ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.feesAcceptable ? "✓" : "✗"} Fees Acceptable
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.gasCostAcceptable ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.gasCostAcceptable ? "✓" : "✗"} Gas Cost Acceptable
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.minProfitThreshold ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.minProfitThreshold ? "✓" : "✗"} Min Profit Threshold
                        </Text>
                      </HStack>
                    </SimpleGrid>
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}

        {nonProfitableOpps.length > 0 && (
          <Box>
            <Heading size="md" mb={4} color="gray.600">
              Non-Profitable Opportunities ({nonProfitableOpps.length})
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              {nonProfitableOpps.map((opp, index) => (
                <Box
                  key={index}
                  p={4}
                  bg="gray.50"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="lg"
                  boxShadow="sm"
                >
                  <Flex justify="space-between" align="start" mb={4}>
                    <Box>
                      <Heading size="sm" color="gray.700">{opp.pairKey}</Heading>
                      <Text fontSize="sm" color="gray.600">Amount: {opp.amount} USDC</Text>
                    </Box>
                    <Box textAlign="right">
                      <Text fontSize="xl" fontWeight="bold" color="gray.600">
                        {opp.details.profitPercentage.toFixed(4)}%
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {opp.opportunity.profit.toFixed(6)} USDC
                      </Text>
                    </Box>
                  </Flex>

                  <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
                    <Box>
                      <Text fontWeight="medium" mb={2}>Price Impact</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">
                          Quickswap: {(opp.details.priceImpact.quickswap * 100).toFixed(4)}%
                        </Text>
                        <Text fontSize="sm">
                          Sushiswap: {(opp.details.priceImpact.sushiswap * 100).toFixed(4)}%
                        </Text>
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="medium" mb={2}>Costs</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">Fees: {opp.details.fees.toFixed(6)} USDC</Text>
                        <Text fontSize="sm">Gas: {opp.details.gasCost.toFixed(6)} MATIC</Text>
                      </VStack>
                    </Box>
                  </Grid>

                  <Box>
                    <Text fontWeight="medium" mb={2}>Conditions</Text>
                    <SimpleGrid columns={2} spacing={2}>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.profitPositive ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.profitPositive ? "✓" : "✗"} Profit Positive
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.feesAcceptable ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.feesAcceptable ? "✓" : "✗"} Fees Acceptable
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.gasCostAcceptable ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.gasCostAcceptable ? "✓" : "✗"} Gas Cost Acceptable
                        </Text>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm" color={opp.details?.conditions?.minProfitThreshold ? "green.500" : "red.500"}>
                          {opp.details?.conditions?.minProfitThreshold ? "✓" : "✗"} Min Profit Threshold
                        </Text>
                      </HStack>
                    </SimpleGrid>
                  </Box>

                  {/* Add Profit Calculation Breakdown */}
                  <Box mt={4} p={3} bg="gray.100" borderRadius="md">
                    <Text fontWeight="medium" mb={2}>Profit Calculation Breakdown</Text>
                    <VStack align="stretch" spacing={2}>
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Initial Investment:</Text>
                        <Text fontSize="sm" color="blue.600" fontWeight="bold">
                          {opp.amount || 0} USDC
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">After First Trade:</Text>
                        <Text fontSize="sm" color="gray.600">
                          {opp.details?.afterFirstTrade?.toFixed(6) || '0.000000'} {opp.pairKey.split('-')[1]}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">After Second Trade:</Text>
                        <Text fontSize="sm" color="gray.600">
                          {opp.details?.afterSecondTrade?.toFixed(6) || '0.000000'} USDC
                        </Text>
                      </Box>
                      <Divider />
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Costs:</Text>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" color="red.500">
                            - Fees: {opp.details?.fees?.toFixed(6) || '0.000000'} USDC
                          </Text>
                          <Text fontSize="sm" color="red.500">
                            - Gas: {opp.details?.gasCost?.toFixed(6) || '0.000000'} MATIC
                          </Text>
                        </VStack>
                      </Box>
                      <Divider />
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Final Amount:</Text>
                        <Text fontSize="sm" color={opp.opportunity?.profit > 0 ? "green.600" : "red.600"} fontWeight="bold">
                          {opp.details?.finalAmount?.toFixed(6) || '0.000000'} USDC
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">Net Profit/Loss:</Text>
                        <Text fontSize="sm" color={opp.opportunity?.profit > 0 ? "green.600" : "red.600"} fontWeight="bold">
                          {opp.opportunity?.profit > 0 ? "+" : ""}{opp.opportunity?.profit?.toFixed(6) || '0.000000'} USDC
                          ({opp.details?.profitPercentage?.toFixed(4) || '0.0000'}%)
                        </Text>
                      </Box>
                    </VStack>
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}

        <Box mt={4}>
          <Text fontSize="sm" color="gray.500">
            Last updated: {new Date().toLocaleTimeString()}
          </Text>
        </Box>
      </VStack>
    );
  };

  return (
    <ChakraProvider>
      <Box p={8} maxW="1200px" mx="auto">
        <VStack spacing={8} align="stretch">
          <Heading textAlign="center" mb={8}>Flash Loan Arbitrage Bot</Heading>
          
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <Heading size="md">Connection Status</Heading>
            </CardHeader>
            <CardBody>
              <Badge colorScheme={isConnected ? "green" : "red"} fontSize="lg">
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </CardBody>
          </Card>

          {/* Price Monitoring Section */}
          <Card>
            <CardHeader>
              <Heading size="md">Real-time Price Monitoring</Heading>
              <Text fontSize="sm" color="gray.500">Updates every 10 seconds</Text>
            </CardHeader>
            <CardBody>
              <Tabs>
                <TabList>
                  {Object.keys(prices).map(pairKey => (
                    <Tab key={pairKey}>{pairKey}</Tab>
                  ))}
                </TabList>
                <TabPanels>
                  {Object.entries(prices).map(([pairKey, pairPrices]) => (
                    <TabPanel key={pairKey}>
                      <SimpleGrid columns={2} spacing={8}>
                        <Box>
                          <Heading size="sm" mb={4}>Uniswap</Heading>
                          <Stat>
                            <StatLabel>Price</StatLabel>
                            <StatNumber>{pairPrices.uniswap.price0.toFixed(6)}</StatNumber>
                            <StatHelpText>
                              {pairPrices.uniswap.token0.symbol}/{pairPrices.uniswap.token1.symbol}
                            </StatHelpText>
                          </Stat>
                        </Box>
                        <Box>
                          <Heading size="sm" mb={4}>SushiSwap</Heading>
                          <Stat>
                            <StatLabel>Price</StatLabel>
                            <StatNumber>{pairPrices.sushiswap.price0.toFixed(6)}</StatNumber>
                            <StatHelpText>
                              {pairPrices.sushiswap.token0.symbol}/{pairPrices.sushiswap.token1.symbol}
                            </StatHelpText>
                          </Stat>
                        </Box>
                      </SimpleGrid>
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>

          {/* Arbitrage Opportunities Section */}
          <Card>
            <CardHeader>
              <Heading size="md">Arbitrage Opportunities</Heading>
            </CardHeader>
            <CardBody>
              <FormControl mb={6}>
                <FormLabel>Amount to Trade (USDC)</FormLabel>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount in USDC"
                  isDisabled={useOptimalAmount}
                />
                <Button
                  mt={2}
                  colorScheme={useOptimalAmount ? "green" : "gray"}
                  onClick={() => setUseOptimalAmount(!useOptimalAmount)}
                >
                  {useOptimalAmount ? "Using Optimal Amounts" : "Use Custom Amount"}
                </Button>
              </FormControl>

              {renderOpportunities()}
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </ChakraProvider>
  );
}

export default App;
