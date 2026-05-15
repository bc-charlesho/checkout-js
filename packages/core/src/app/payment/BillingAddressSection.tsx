import { type Address, type FormField, isExtraField } from '@bigcommerce/checkout-sdk/essential';
import { Formik, useFormikContext } from 'formik';
import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type ReactElement,
} from 'react';

import { useCapabilities, useCheckout } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { usePayPalFastlaneAddress } from '@bigcommerce/checkout/paypal-fastlane-integration';
import { AddressFormSkeleton, LoadingOverlay } from '@bigcommerce/checkout/ui';

import {
    AddressForm,
    type AddressFormValues,
    AddressSelect,
    AddressType,
    B2BExtraFieldsSessionStorage,
    isValidCustomerAddress,
    mapAddressToFormValues,
} from '../address';
import { StaticBillingAddress } from '../billing';
import BillingSameAsShippingField from '../shipping/BillingSameAsShippingField';
import { Fieldset, Legend } from '../ui/form';

export interface BillingAddressSectionHandle {
    getValues(): AddressFormValues | null;
}

export interface BillingAddressSectionProps {
    billingAddress?: Address;
    hideHeading?: boolean;
    isBillingSameAsShipping: boolean;
    isShippingRequired?: boolean;
    isUsingMultiShipping?: boolean;
    methodId?: string;
    getFields(countryCode?: string): FormField[];
    onBillingSameAsShippingChange(checked: boolean): void;
    onUnhandledError(error: Error): void;
}

interface BillingFormObserverProps {
    onValuesChange(values: AddressFormValues): void;
}

const BillingFormObserver = ({ onValuesChange }: BillingFormObserverProps): null => {
    const { values } = useFormikContext<AddressFormValues>();

    useEffect(() => {
        onValuesChange(values);
    });

    return null;
};

interface BillingAddressFormBodyProps extends BillingAddressSectionProps, WithLanguageProps {
    onValuesChange(values: AddressFormValues): void;
}

const BillingAddressFormBody = ({
    billingAddress,
    methodId,
    getFields,
    onUnhandledError,
    onValuesChange,
}: BillingAddressFormBodyProps): ReactElement => {
    const [isResettingAddress, setIsResettingAddress] = useState(false);
    const { checkoutService, checkoutState } = useCheckout();
    const { billing: { hideSaveToAddressBookCheck, restrictManualAddressEntry } } = useCapabilities();
    const { isPayPalFastlaneEnabled, paypalFastlaneAddresses } = usePayPalFastlaneAddress();
    const { setFieldValue, setValues, values } = useFormikContext<AddressFormValues>();

    const { data: { getCustomer } } = checkoutState;
    const customer = getCustomer();

    const isGuest = customer?.isGuest ?? true;
    const addresses = customer?.addresses ?? [];
    const shouldRenderStaticAddress = methodId === 'amazonpay';
    const allFormFields = getFields(values.countryCode);
    const customOrExtraFields = allFormFields.filter((field) => field.custom || isExtraField(field));
    const hasCustomOrExtraFields = customOrExtraFields.length > 0;
    const editableFormFields =
        shouldRenderStaticAddress && hasCustomOrExtraFields ? customOrExtraFields : allFormFields;
    const billingAddresses = isGuest && isPayPalFastlaneEnabled ? paypalFastlaneAddresses : addresses;
    const hasAddresses = billingAddresses?.length > 0;
    const hasValidCustomerAddress =
        billingAddress &&
        isValidCustomerAddress(
            billingAddress,
            billingAddresses,
            getFields(billingAddress.countryCode),
        );
    const shouldShowSaveAddress = !hideSaveToAddressBookCheck && !isGuest;

    const handleSelectAddress = async (address: Partial<Address>) => {
        setIsResettingAddress(true);

        try {
            await checkoutService.updateBillingAddress(address);

            const mapped = mapAddressToFormValues(
                getFields((address as Address).countryCode),
                address as Address,
                B2BExtraFieldsSessionStorage.BILLING_KEY,
            );

            void setValues(mapped);
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        } finally {
            setIsResettingAddress(false);
        }
    };

    const handleUseNewAddress = () => {
        void handleSelectAddress({});
    };

    return (
        <>
            <BillingFormObserver onValuesChange={onValuesChange} />

            {shouldRenderStaticAddress && billingAddress && (
                <div className="form-fieldset">
                    <StaticBillingAddress address={billingAddress} />
                </div>
            )}

            <Fieldset id="checkoutBillingAddress">
                {hasAddresses && !shouldRenderStaticAddress && (
                    <Fieldset id="billingAddresses">
                        <LoadingOverlay isLoading={isResettingAddress}>
                            <AddressSelect
                                addresses={billingAddresses}
                                onSelectAddress={handleSelectAddress}
                                onUseNewAddress={handleUseNewAddress}
                                selectedAddress={
                                    hasValidCustomerAddress ? billingAddress : undefined
                                }
                                storageKey={B2BExtraFieldsSessionStorage.BILLING_KEY}
                                type={AddressType.Billing}
                            />
                        </LoadingOverlay>
                    </Fieldset>
                )}

                {!restrictManualAddressEntry && !hasValidCustomerAddress && (
                    <AddressFormSkeleton isLoading={isResettingAddress}>
                        <AddressForm
                            countryCode={values.countryCode}
                            formFields={editableFormFields}
                            setFieldValue={setFieldValue}
                            shouldShowSaveAddress={shouldShowSaveAddress}
                            type={AddressType.Billing}
                        />
                    </AddressFormSkeleton>
                )}
            </Fieldset>
        </>
    );
};

const BillingAddressFormBodyWithLanguage = withLanguage(BillingAddressFormBody);

const BillingAddressSection = forwardRef<BillingAddressSectionHandle, BillingAddressSectionProps>(
    (
        {
            billingAddress,
            hideHeading,
            isBillingSameAsShipping,
            isShippingRequired = true,
            isUsingMultiShipping,
            methodId,
            getFields,
            onBillingSameAsShippingChange,
            onUnhandledError,
        },
        ref,
    ) => {
        const currentValuesRef = useRef<AddressFormValues | null>(null);

        const shouldHideSameAsShippingCheckbox = isUsingMultiShipping || !isShippingRequired;

        useImperativeHandle(ref, () => ({
            getValues: () => {
                if (isBillingSameAsShipping && !shouldHideSameAsShippingCheckbox) {
                    return null;
                }

                return currentValuesRef.current;
            },
        }));

        const addressInitialValues = mapAddressToFormValues(
            getFields(billingAddress?.countryCode),
            billingAddress,
            B2BExtraFieldsSessionStorage.BILLING_KEY,
        );

        const initialValues = {
            ...addressInitialValues,
            billingSameAsShipping: isBillingSameAsShipping,
        };

        return (
            <div className="checkout-form" data-test="billing-address-section" style={hideHeading ? { paddingBottom: '1rem' } : undefined}>
                {!hideHeading && (
                    <div className="form-legend-container">
                        <Legend testId="billing-address-heading">
                            <TranslatedString id="billing.billing_address_heading" />
                        </Legend>
                    </div>
                )}

                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    onSubmit={() => undefined}
                >
                    {() => (
                        <>
                            {!shouldHideSameAsShippingCheckbox && (
                                <div
                                    className="form-body"
                                    style={hideHeading ? { marginBottom: '1rem' } : undefined}
                                >
                                    <BillingSameAsShippingField onChange={onBillingSameAsShippingChange} />
                                </div>
                            )}

                            {(!isBillingSameAsShipping || shouldHideSameAsShippingCheckbox) && (
                                <BillingAddressFormBodyWithLanguage
                                    billingAddress={billingAddress}
                                    getFields={getFields}
                                    isBillingSameAsShipping={isBillingSameAsShipping}
                                    methodId={methodId}
                                    onBillingSameAsShippingChange={onBillingSameAsShippingChange}
                                    onUnhandledError={onUnhandledError}
                                    onValuesChange={(values) => {
                                        currentValuesRef.current = values;
                                    }}
                                />
                            )}
                        </>
                    )}
                </Formik>
            </div>
        );
    },
);

BillingAddressSection.displayName = 'BillingAddressSection';

export default BillingAddressSection;
