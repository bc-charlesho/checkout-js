import { createContext, type ReactNode, useContext } from 'react';

interface BillingAddressSectionContextProps {
    billingSection: ReactNode;
}

export const BillingAddressSectionContext = createContext<BillingAddressSectionContextProps>({
    billingSection: null,
});

export function useBillingAddressSection(): BillingAddressSectionContextProps {
    return useContext(BillingAddressSectionContext);
}
