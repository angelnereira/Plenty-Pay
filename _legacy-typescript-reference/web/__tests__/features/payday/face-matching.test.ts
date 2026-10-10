/**
 * Unit Tests for Face Recognition Matching Logic
 * 
 * Tests the euclidean distance calculation and threshold matching
 * used in the facial recognition system.
 */

// Euclidean distance function (mirrors the one in check-in.ts)
function euclideanDistance(desc1: number[], desc2: number[]) {
    return Math.sqrt(
        desc1
            .map((val, i) => val - desc2[i])
            .reduce((sum, diff) => sum + diff * diff, 0)
    );
}

// Matching threshold (same as production)
const MATCH_THRESHOLD = 0.55;

function isMatch(desc1: number[], desc2: number[], threshold = MATCH_THRESHOLD) {
    const distance = euclideanDistance(desc1, desc2);
    return distance < threshold;
}

describe('euclideanDistance', () => {
    it('should return 0 for identical descriptors', () => {
        const descriptor = Array(128).fill(0).map((_, i) => Math.random());
        expect(euclideanDistance(descriptor, descriptor)).toBe(0);
    });

    it('should return correct distance for simple vectors', () => {
        const desc1 = [0, 0, 0];
        const desc2 = [3, 4, 0];
        // sqrt(3^2 + 4^2 + 0^2) = sqrt(9 + 16) = sqrt(25) = 5
        expect(euclideanDistance(desc1, desc2)).toBe(5);
    });

    it('should handle negative values', () => {
        const desc1 = [-1, -1];
        const desc2 = [1, 1];
        // sqrt((1-(-1))^2 + (1-(-1))^2) = sqrt(4 + 4) = sqrt(8) ≈ 2.828
        expect(euclideanDistance(desc1, desc2)).toBeCloseTo(2.828, 2);
    });

    it('should handle floating point values typical of face descriptors', () => {
        const desc1 = [0.123, -0.456, 0.789];
        const desc2 = [0.234, -0.567, 0.890];
        // Calculate expected
        const expected = Math.sqrt(
            Math.pow(0.123 - 0.234, 2) +
            Math.pow(-0.456 - (-0.567), 2) +
            Math.pow(0.789 - 0.890, 2)
        );
        expect(euclideanDistance(desc1, desc2)).toBeCloseTo(expected, 10);
    });

    it('should handle 128-dimensional vectors (face descriptors)', () => {
        const desc1 = Array(128).fill(0);
        const desc2 = Array(128).fill(0.1);
        // sqrt(128 * 0.1^2) = sqrt(128 * 0.01) = sqrt(1.28) ≈ 1.131
        expect(euclideanDistance(desc1, desc2)).toBeCloseTo(1.131, 2);
    });
});

describe('isMatch', () => {
    it('should return true for identical descriptors', () => {
        const descriptor = Array(128).fill(0).map(() => Math.random() * 0.2 - 0.1);
        expect(isMatch(descriptor, descriptor)).toBe(true);
    });

    it('should return true for very similar descriptors (distance < threshold)', () => {
        const desc1 = Array(128).fill(0.1);
        const desc2 = Array(128).fill(0.1).map(v => v + 0.001); // Very slight difference
        expect(isMatch(desc1, desc2)).toBe(true);
    });

    it('should return false for dissimilar descriptors (distance >= threshold)', () => {
        const desc1 = Array(128).fill(0);
        const desc2 = Array(128).fill(0.2); // sqrt(128 * 0.2^2) = sqrt(5.12) ≈ 2.26
        expect(isMatch(desc1, desc2)).toBe(false);
    });

    it('should respect custom threshold', () => {
        const desc1 = [0, 0, 0];
        const desc2 = [3, 4, 0]; // distance = 5

        expect(isMatch(desc1, desc2, 4)).toBe(false); // threshold 4, distance 5 -> no match
        expect(isMatch(desc1, desc2, 6)).toBe(true);  // threshold 6, distance 5 -> match
    });

    it('should be symmetric (order of descriptors does not matter)', () => {
        const desc1 = Array(128).fill(0).map(() => Math.random());
        const desc2 = Array(128).fill(0).map(() => Math.random());

        expect(isMatch(desc1, desc2)).toBe(isMatch(desc2, desc1));
    });
});

describe('face matching edge cases', () => {
    it('should handle all zeros', () => {
        const desc1 = Array(128).fill(0);
        const desc2 = Array(128).fill(0);
        expect(euclideanDistance(desc1, desc2)).toBe(0);
        expect(isMatch(desc1, desc2)).toBe(true);
    });

    it('should handle very small values', () => {
        const desc1 = Array(128).fill(1e-10);
        const desc2 = Array(128).fill(2e-10);
        expect(euclideanDistance(desc1, desc2)).toBeCloseTo(Math.sqrt(128 * 1e-20), 15);
    });

    it('should handle normalized descriptors (typical from face-api)', () => {
        // Face-api descriptors are typically L2-normalized
        // Creating two normalized vectors
        const randomValues = Array(128).fill(0).map(() => Math.random() - 0.5);
        const norm = Math.sqrt(randomValues.reduce((sum, v) => sum + v * v, 0));
        const normalized = randomValues.map(v => v / norm);

        // The L2 norm of a normalized vector should be 1
        const l2norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
        expect(l2norm).toBeCloseTo(1, 10);
    });

    it('should produce consistent results with production threshold', () => {
        // Simulate a "same person" scenario: distance around 0.3-0.4
        const baseFace = Array(128).fill(0).map(() => Math.random() * 0.1);
        const samePerson = baseFace.map(v => v + (Math.random() - 0.5) * 0.02);

        const distance = euclideanDistance(baseFace, samePerson);
        // With small perturbations, should be well under threshold
        expect(distance).toBeLessThan(MATCH_THRESHOLD);
        expect(isMatch(baseFace, samePerson)).toBe(true);
    });
});
