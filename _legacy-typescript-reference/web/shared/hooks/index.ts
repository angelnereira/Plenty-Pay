/**
 * Hooks - Barrel Export
 * 
 * Reusable React hooks for PlentyPay application.
 */

// Invoice Hooks
export { useInvoiceEmission, type EmissionResult, type EmissionState, type UseInvoiceEmissionReturn } from './use-invoice-emission';
export { useInvoiceItems, type InvoiceItem, type ItemTotals, type AddItemInput, type UseInvoiceItemsReturn } from './use-invoice-items';

// Validation Hooks
export { useRUCValidation, type RUCValidationState, type ValidateRUCOptions, type UseRUCValidationReturn } from './use-ruc-validation';

// State Machine Hooks
export { useMachine, useMachineConfig, useWizardMachine, type WizardStep as MachineWizardStep, type UseWizardMachineOptions } from './use-machine';

// Observable Hooks
export { useObservable, useObservableSelector, useWritableObservable, useStore, useCombinedObservables } from './use-observable';

// Existing Hooks
export { useDashboardData } from './use-dashboard-data';
export { useInvoices } from './use-invoices';
export { useToast, toast } from './use-toast';


