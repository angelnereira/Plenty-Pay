/**
 * Specifications Module - Barrel Export
 */

// Base specification
export {
    Specification,
    SpecificationBuilder,
    IdSpec,
    DateRangeSpec,
    IsActiveSpec,
    ClientIdSpec,
    ContainsSpec,
    AndSpecification,
    OrSpecification,
    NotSpecification,
    type ISpecification,
} from './specification';

// Invoice specifications
export {
    InvoiceSpec,
    InvoiceSpecBuilder,
    InvoiceStatusSpec,
    HasCufeSpec,
    InvoiceAmountSpec,
    InvoiceFromLastDaysSpec,
    InvoiceCurrentMonthSpec,
    InvoiceNumberSpec,
    InvoiceReceiverSpec,
    type InvoiceEntity,
    type InvoiceStatus,
} from './invoice.specifications';
