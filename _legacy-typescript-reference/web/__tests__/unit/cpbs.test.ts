import { deriveCpbsSegment, isValidCpbsCode } from '@/features/invoicing/model/utils/cpbs.utils';

describe('CPBS Logic Utilities', () => {
    describe('deriveCpbsSegment', () => {
        it('should derive 2-digit segment from 4-digit family code', () => {
            expect(deriveCpbsSegment('8013')).toBe('80');
            expect(deriveCpbsSegment('7215')).toBe('72');
            expect(deriveCpbsSegment('1010')).toBe('10');
        });

        it('should return undefined for invalid codes', () => {
            expect(deriveCpbsSegment('')).toBeUndefined();
            expect(deriveCpbsSegment('1')).toBeUndefined();
            expect(deriveCpbsSegment(undefined)).toBeUndefined();
        });
    });

    describe('isValidCpbsCode', () => {
        it('should return true for valid 4-digit codes', () => {
            expect(isValidCpbsCode('8013')).toBe(true);
            expect(isValidCpbsCode('0001')).toBe(true);
        });

        it('should return false for invalid codes', () => {
            expect(isValidCpbsCode('801')).toBe(false);
            expect(isValidCpbsCode('80131')).toBe(false);
            expect(isValidCpbsCode('80A3')).toBe(false);
            expect(isValidCpbsCode('')).toBe(false);
            expect(isValidCpbsCode(undefined)).toBe(false);
        });
    });
});
