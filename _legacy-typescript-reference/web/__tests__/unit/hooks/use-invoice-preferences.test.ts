import { renderHook, act } from '@testing-library/react';
import { useInvoicePreferences } from '@/shared/hooks/use-invoice-preferences';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
        mockStorage[key] = value;
    },
    removeItem: (key: string) => {
        delete mockStorage[key];
    },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useInvoicePreferences', () => {
    beforeEach(() => {
        // limpiar storage entre tests
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    });

    it('retorna prefs vacías si clientId es null', () => {
        const { result } = renderHook(() => useInvoicePreferences(null));
        expect(result.current.prefs).toEqual({});
    });

    it('persiste y lee una preferencia', () => {
        const { result } = renderHook(() => useInvoicePreferences('client-1'));
        act(() => {
            result.current.setPref('formaPagoFact', '02');
        });
        expect(result.current.prefs.formaPagoFact).toBe('02');
        expect(mockStorage['plentypay_inv_prefs_client-1']).toContain('02');
    });

    it('carga prefs existentes al montar con clientId', () => {
        mockStorage['plentypay_inv_prefs_client-2'] = JSON.stringify({ formaPagoFact: '08' });
        const { result } = renderHook(() => useInvoicePreferences('client-2'));
        expect(result.current.prefs.formaPagoFact).toBe('08');
    });

    it('clear elimina prefs del storage', () => {
        const { result } = renderHook(() => useInvoicePreferences('client-3'));
        act(() => {
            result.current.setPref('formaPagoFact', '03');
        });
        act(() => {
            result.current.clear();
        });
        expect(result.current.prefs).toEqual({});
        expect(mockStorage['plentypay_inv_prefs_client-3']).toBeUndefined();
    });

    it('no toca storage si clientId es null', () => {
        const { result } = renderHook(() => useInvoicePreferences(null));
        act(() => {
            result.current.setPref('formaPagoFact', '02');
        });
        expect(Object.keys(mockStorage)).toHaveLength(0);
    });
});
