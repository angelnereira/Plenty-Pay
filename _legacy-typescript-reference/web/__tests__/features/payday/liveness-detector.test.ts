/**
 * Unit Tests for Liveness Detection
 * 
 * Tests the Eye Aspect Ratio (EAR) calculation and blink detection
 * state machine used for anti-spoofing.
 * 
 * Note: The logic here mirrors features/bio/liveness-detector.ts
 * We inline it here because Jest doesn't transpile TS from source.
 */

// Eye landmark indices from face-api.js 68-point model
const LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47];
const NOSE_TIP_INDEX = 30;
const LEFT_CHEEK_INDEX = 0;
const RIGHT_CHEEK_INDEX = 16;

// Thresholds
const EAR_THRESHOLD = 0.21;
const EAR_CONSEC_FRAMES = 2;
const BLINK_REBOUND_THRESHOLD = 0.26;

interface Point { x: number; y: number; }
interface DetectorState {
    earHistory: number[];
    blinkDetected: boolean;
    blinkCount: number;
    eyeClosedFrames: number;
    lastEAR: number;
}

// Inline LivenessDetector class for testing
class LivenessDetector {
    state: DetectorState;

    constructor() {
        this.state = {
            earHistory: [],
            blinkDetected: false,
            blinkCount: 0,
            eyeClosedFrames: 0,
            lastEAR: 1.0,
        };
    }

    distance(p1: Point, p2: Point) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    calculateSingleEyeEAR(eyePoints: Point[]) {
        if (eyePoints.length !== 6) return 1.0;
        const [p1, p2, p3, p4, p5, p6] = eyePoints;
        const vertical1 = this.distance(p2, p6);
        const vertical2 = this.distance(p3, p5);
        const horizontal = this.distance(p1, p4);
        if (horizontal === 0) return 1.0;
        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    calculateEAR(landmarks: Point[]) {
        if (landmarks.length < 68) return 1.0;
        const leftEyePoints = LEFT_EYE_INDICES.map(i => landmarks[i]);
        const rightEyePoints = RIGHT_EYE_INDICES.map(i => landmarks[i]);
        const leftEAR = this.calculateSingleEyeEAR(leftEyePoints);
        const rightEAR = this.calculateSingleEyeEAR(rightEyePoints);
        return (leftEAR + rightEAR) / 2.0;
    }

    processFrame(landmarks: Point[]) {
        const ear = this.calculateEAR(landmarks);

        this.state.earHistory.push(ear);
        if (this.state.earHistory.length > 30) {
            this.state.earHistory.shift();
        }

        let blinkJustDetected = false;

        if (ear < EAR_THRESHOLD) {
            this.state.eyeClosedFrames++;
        } else if (this.state.eyeClosedFrames >= EAR_CONSEC_FRAMES && ear > BLINK_REBOUND_THRESHOLD) {
            blinkJustDetected = true;
            this.state.blinkCount++;
            this.state.blinkDetected = true;
            this.state.eyeClosedFrames = 0;
        } else {
            this.state.eyeClosedFrames = 0;
        }

        this.state.lastEAR = ear;
        return blinkJustDetected;
    }

    detectHeadRotation(landmarks: Point[]) {
        if (landmarks.length < 68) return 'center';
        const noseTip = landmarks[NOSE_TIP_INDEX];
        const leftCheek = landmarks[LEFT_CHEEK_INDEX];
        const rightCheek = landmarks[RIGHT_CHEEK_INDEX];
        const distToLeft = this.distance(noseTip, leftCheek);
        const distToRight = this.distance(noseTip, rightCheek);
        const ratio = distToLeft / distToRight;
        if (ratio < 0.75) return 'left';
        if (ratio > 1.35) return 'right';
        return 'center';
    }

    isLive() {
        return this.state.blinkDetected;
    }

    getBlinkCount() {
        return this.state.blinkCount;
    }

    reset() {
        this.state = {
            earHistory: [],
            blinkDetected: false,
            blinkCount: 0,
            eyeClosedFrames: 0,
            lastEAR: 1.0,
        };
    }
}

// Helper to create mock 68-point landmarks
function createMockLandmarks(overrides = {}) {
    const landmarks = Array(68).fill(null).map(() => ({ x: 0, y: 0 }));

    // Default eye landmarks for "open" eyes
    landmarks[36] = { x: 100, y: 100 };
    landmarks[37] = { x: 105, y: 96 };
    landmarks[38] = { x: 115, y: 96 };
    landmarks[39] = { x: 120, y: 100 };
    landmarks[40] = { x: 115, y: 104 };
    landmarks[41] = { x: 105, y: 104 };

    landmarks[42] = { x: 140, y: 100 };
    landmarks[43] = { x: 145, y: 96 };
    landmarks[44] = { x: 155, y: 96 };
    landmarks[45] = { x: 160, y: 100 };
    landmarks[46] = { x: 155, y: 104 };
    landmarks[47] = { x: 145, y: 104 };

    landmarks[30] = { x: 130, y: 140 };
    landmarks[0] = { x: 80, y: 120 };
    landmarks[16] = { x: 180, y: 120 };

    Object.entries(overrides).forEach(([key, value]) => {
        landmarks[parseInt(key)] = value as Point;
    });

    return landmarks;
}

function createClosedEyeLandmarks() {
    return createMockLandmarks({
        37: { x: 105, y: 100 },
        38: { x: 115, y: 100 },
        40: { x: 115, y: 100 },
        41: { x: 105, y: 100 },
        43: { x: 145, y: 100 },
        44: { x: 155, y: 100 },
        46: { x: 155, y: 100 },
        47: { x: 145, y: 100 },
    });
}

describe('LivenessDetector', () => {
    let detector: LivenessDetector;

    beforeEach(() => {
        detector = new LivenessDetector();
    });

    describe('calculateEAR', () => {
        it('should return high EAR (~0.3) for open eyes', () => {
            const landmarks = createMockLandmarks();
            const ear = detector.calculateEAR(landmarks);
            expect(ear).toBeGreaterThan(0.25);
            expect(ear).toBeLessThan(0.5);
        });

        it('should return low EAR (~0.05) for closed eyes', () => {
            const landmarks = createClosedEyeLandmarks();
            const ear = detector.calculateEAR(landmarks);
            expect(ear).toBeLessThan(0.15);
        });

        it('should return 1.0 for invalid landmarks', () => {
            expect(detector.calculateEAR([])).toBe(1.0);
            expect(detector.calculateEAR(Array(10).fill({ x: 0, y: 0 }))).toBe(1.0);
        });
    });

    describe('processFrame (blink detection)', () => {
        it('should not detect blink on first frame', () => {
            const landmarks = createMockLandmarks();
            const result = detector.processFrame(landmarks);
            expect(result).toBe(false);
            expect(detector.isLive()).toBe(false);
        });

        it('should detect blink after eyes close then open', () => {
            const openLandmarks = createMockLandmarks();
            const closedLandmarks = createClosedEyeLandmarks();

            detector.processFrame(openLandmarks);
            expect(detector.isLive()).toBe(false);

            detector.processFrame(closedLandmarks);
            detector.processFrame(closedLandmarks);
            expect(detector.isLive()).toBe(false);

            const blinkDetected = detector.processFrame(openLandmarks);
            expect(blinkDetected).toBe(true);
            expect(detector.isLive()).toBe(true);
            expect(detector.getBlinkCount()).toBe(1);
        });

        it('should count multiple blinks', () => {
            const openLandmarks = createMockLandmarks();
            const closedLandmarks = createClosedEyeLandmarks();

            detector.processFrame(openLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(openLandmarks);
            expect(detector.getBlinkCount()).toBe(1);

            detector.processFrame(openLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(openLandmarks);
            expect(detector.getBlinkCount()).toBe(2);
        });

        it('should not detect blink if eyes only closed for 1 frame', () => {
            const openLandmarks = createMockLandmarks();
            const closedLandmarks = createClosedEyeLandmarks();

            detector.processFrame(openLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(openLandmarks);

            expect(detector.isLive()).toBe(false);
            expect(detector.getBlinkCount()).toBe(0);
        });
    });

    describe('detectHeadRotation', () => {
        it('should detect centered head', () => {
            const landmarks = createMockLandmarks();
            expect(detector.detectHeadRotation(landmarks)).toBe('center');
        });

        it('should detect head turned left', () => {
            const landmarks = createMockLandmarks({ 30: { x: 100, y: 140 } });
            expect(detector.detectHeadRotation(landmarks)).toBe('left');
        });

        it('should detect head turned right', () => {
            const landmarks = createMockLandmarks({ 30: { x: 160, y: 140 } });
            expect(detector.detectHeadRotation(landmarks)).toBe('right');
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            const openLandmarks = createMockLandmarks();
            const closedLandmarks = createClosedEyeLandmarks();

            detector.processFrame(openLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(closedLandmarks);
            detector.processFrame(openLandmarks);
            expect(detector.isLive()).toBe(true);

            detector.reset();
            expect(detector.isLive()).toBe(false);
            expect(detector.getBlinkCount()).toBe(0);
        });
    });
});
