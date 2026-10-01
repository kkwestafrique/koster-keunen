// Compatibility shim. The implementation now lives in the contracts feature
// module (src/features/contracts); this file keeps the original import path
// working for existing consumers so the refactor changes zero call sites.
export {
  useContractYears, useContracts, useContract, useContractDeliveries,
  useCreateContractDelivery, useCreateContract, useUpdateContractGroup,
  useContractsForLinking, useContractFulfillment,
} from '@/features/contracts';
