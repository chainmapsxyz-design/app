// Map network labels to their Etherscan-family API bases
const EXPLORER_BASE = {
  'Ethereum Mainnet': 'https://api.etherscan.io/api',
  'Sepolia Testnet': 'https://api-sepolia.etherscan.io/api',
  Polygon: 'https://api.polygonscan.com/api',
  'Polygon Mumbai': 'https://api-testnet.polygonscan.com/api',
  Arbitrum: 'https://api.arbiscan.io/api',
  'Arbitrum Sepolia': 'https://api-sepolia.arbiscan.io/api',
  Optimism: 'https://api-optimistic.etherscan.io/api',
  Base: 'https://api.basescan.org/api',
  'Base Sepolia': 'https://api-sepolia.basescan.org/api',
};

// Get your API key per explorer family (can also just reuse the same key string)
const API_KEY = {
  'Ethereum Mainnet': import.meta.env.VITE_ETHERSCAN_KEY,
  'Sepolia Testnet': import.meta.env.VITE_ETHERSCAN_KEY,
  Polygon: import.meta.env.VITE_POLYGONSCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  'Polygon Mumbai': import.meta.env.VITE_POLYGONSCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  Arbitrum: import.meta.env.VITE_ARBISCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  'Arbitrum Sepolia': import.meta.env.VITE_ARBISCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  Optimism: import.meta.env.VITE_OPTIMISTICSCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  Base: import.meta.env.VITE_BASESCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
  'Base Sepolia': import.meta.env.VITE_BASESCAN_KEY ?? import.meta.env.VITE_ETHERSCAN_KEY,
};

// Fetch JSON with basic error handling
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status === '0') throw new Error(json.result || 'Explorer error');
  return json;
}

/**
 * Fetch metadata (name, ABI) for a contract address on a given network.
 * Uses `getsourcecode` which returns: ContractName, ABI, Proxy, Implementation, etc.
 */
export async function fetchContractSource(network, address) {
  const base = EXPLORER_BASE[network];
  const key = API_KEY[network];
  if (!base) throw new Error(`Unsupported network: ${network}`);
  if (!key) throw new Error(`Missing API key for ${network}`);

  const url = `${base}?module=contract&action=getsourcecode&address=${address}&apikey=${key}`;
  const json = await getJSON(url);
  const item = Array.isArray(json.result) ? json.result[0] : json.result;

  if (!item || !item.ABI || item.ABI === 'Contract source code not verified') {
    throw new Error('Contract is not verified on this explorer (no ABI available).');
  }

  const primary = {
    contractName: item.ContractName || '',
    proxy: item.Proxy === '1',
    implementation: item.Implementation || '',
    abi: JSON.parse(item.ABI),
  };

  // If proxy and we have an implementation address, fetch implementation ABI
  if (primary.proxy && primary.implementation) {
    const implUrl = `${base}?module=contract&action=getsourcecode&address=${primary.implementation}&apikey=${key}`;
    const implJson = await getJSON(implUrl);
    const implItem = implJson.result[0];
    if (implItem && implItem.ABI && implItem.ABI !== 'Contract source code not verified') {
      primary.abi = JSON.parse(implItem.ABI);
      primary.contractName = implItem.ContractName || primary.contractName;
    }
  }

  return primary;
}

/**
 * Return full event fragments (unaltered) + a stable __key and __label
 * so you can disambiguate overloaded events by their input types.
 */
export function extractEventsFromAbi(abiInput) {
  const abi = Array.isArray(abiInput) ? abiInput : JSON.parse(abiInput);
  const events = abi.filter((item) => item && item.type === 'event' && item.name);

  return events.map((e, idx) => {
    const types = (e.inputs || []).map((i) => i.type).join(',');
    const label = `${e.name}(${types})`;
    // __key is stable enough for selection even with proxies / dupes
    return { ...e, __key: `${label}#${idx}`, __label: label };
  });
}
