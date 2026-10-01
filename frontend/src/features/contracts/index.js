// Public API of the contracts feature. Consumers import from here (or from
// the legacy '@/hooks/useContracts' shim) -- never reach into
// hooks/lists.js etc. directly, so these files can keep being reorganised
// without touching any page.
export { useContractYears, useContracts, useContractsForLinking } from './hooks/lists';
export { useContract, useContractDeliveries, useContractFulfillment } from './hooks/detail';
export { useCreateContract } from './hooks/create';
export { useCreateContractDelivery } from './hooks/deliveries';
export { useUpdateContractGroup } from './hooks/update';
