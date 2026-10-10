export type IncotermCode =
    | 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAT' | 'DAP' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';

export const INCOTERMS: Record<IncotermCode, string> = {
    'EXW': 'EX Works',
    'FCA': 'Free CArrier',
    'CPT': 'Carriage Paid To',
    'CIP': 'Carriage and Insurance Paid to',
    'DAT': 'Delivered At Terminal',
    'DAP': 'Delivered At Place',
    'DDP': 'Delivered Duty Paid',
    'FAS': 'Free Alongside Ship',
    'FOB': 'Free On Board',
    'CFR': 'Cost and Freight',
    'CIF': 'Cost Insurance and Freight',
};
