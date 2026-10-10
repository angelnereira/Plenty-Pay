/**
 * Liveness Detection Service - Adaptive Blink Detection
 * 
 * Uses RELATIVE Eye Aspect Ratio (EAR) changes instead of absolute thresholds.
 * This handles varying baseline EAR values due to camera angle, lighting, glasses, etc.
 * 
 * Reference: Eye Aspect Ratio (EAR) formula from Soukupová & Čech (2016)
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 */

// Eye landmark indices from face-api.js 68-point model
// Left eye: 36-41, Right eye: 42-47
const LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47];

// Nose and face contour for head pose
const NOSE_TIP_INDEX = 30;
const LEFT_CHEEK_INDEX = 0;  // Leftmost point of jaw
const RIGHT_CHEEK_INDEX = 16; // Rightmost point of jaw

// Adaptive thresholds - OPTIMIZED FOR SPEED
const EAR_DROP_RATIO = 0.90; // Blink detected if EAR drops to 90% of baseline (10% drop - more sensitive)
const BASELINE_WINDOW = 6;   // Smaller window for faster adaptation
const MIN_FRAMES_FOR_BASELINE = 3; // Fewer frames needed = faster startup

interface Point {
    x: number;
    y: number;
}

interface LivenessState {
    earHistory: number[];
    blinkDetected: boolean;
    blinkCount: number;
    eyeClosedFrames: number;
    lastEAR: number;
    baseline: number;
    blinkPhase: 'open' | 'closing' | 'opening';
}

export class LivenessDetector {
    private state: LivenessState = {
        earHistory: [],
        blinkDetected: false,
        blinkCount: 0,
        eyeClosedFrames: 0,
        lastEAR: 1.0,
        baseline: 0,
        blinkPhase: 'open',
    };

    /**
     * Calculate Euclidean distance between two points
     */
    private distance(p1: Point, p2: Point): number {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    /**
     * Calculate Eye Aspect Ratio (EAR) for a single eye
     * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
     * 
     * Points are numbered 1-6 around the eye:
     * p1 = outer corner, p4 = inner corner
     * p2, p3 = upper lid, p5, p6 = lower lid
     */
    private calculateSingleEyeEAR(eyePoints: Point[]): number {
        if (eyePoints.length !== 6) return 1.0;

        const [p1, p2, p3, p4, p5, p6] = eyePoints;

        // Vertical distances (upper-lower lid)
        const vertical1 = this.distance(p2, p6);
        const vertical2 = this.distance(p3, p5);

        // Horizontal distance (corner to corner)
        const horizontal = this.distance(p1, p4);

        if (horizontal === 0) return 1.0;

        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    /**
     * Calculate average EAR for both eyes from 68-point landmarks
     */
    public calculateEAR(landmarks: Point[]): number {
        if (landmarks.length < 68) {
            console.warn('[Liveness] Insufficient landmarks:', landmarks.length);
            return 1.0;
        }

        const leftEyePoints = LEFT_EYE_INDICES.map(i => landmarks[i]);
        const rightEyePoints = RIGHT_EYE_INDICES.map(i => landmarks[i]);

        const leftEAR = this.calculateSingleEyeEAR(leftEyePoints);
        const rightEAR = this.calculateSingleEyeEAR(rightEyePoints);

        return (leftEAR + rightEAR) / 2.0;
    }

    /**
     * Calculate rolling baseline EAR (average of recent "open eye" frames)
     */
    private updateBaseline(ear: number): void {
        // Use the top 70th percentile of recent EAR values as baseline
        // This filters out blink frames
        if (this.state.earHistory.length >= MIN_FRAMES_FOR_BASELINE) {
            const sorted = [...this.state.earHistory].sort((a, b) => b - a);
            const topCount = Math.max(1, Math.floor(sorted.length * 0.7));
            const topValues = sorted.slice(0, topCount);
            this.state.baseline = topValues.reduce((a, b) => a + b, 0) / topValues.length;
        }
    }

    /**
     * Process a new frame and detect blinks using ADAPTIVE thresholds
     * Returns true if a blink was just completed
     */
    public processFrame(landmarks: Point[]): boolean {
        const ear = this.calculateEAR(landmarks);

        // Store history
        this.state.earHistory.push(ear);
        if (this.state.earHistory.length > BASELINE_WINDOW) {
            this.state.earHistory.shift();
        }

        // Update baseline
        this.updateBaseline(ear);

        let blinkJustDetected = false;

        // Need minimum frames to establish baseline
        if (this.state.earHistory.length < MIN_FRAMES_FOR_BASELINE) {
            this.state.lastEAR = ear;
            return false;
        }

        // Calculate threshold relative to baseline
        const blinkThreshold = this.state.baseline * EAR_DROP_RATIO;

        // State machine for blink detection
        switch (this.state.blinkPhase) {
            case 'open':
                if (ear < blinkThreshold) {
                    this.state.blinkPhase = 'closing';
                    this.state.eyeClosedFrames = 1;
                }
                break;

            case 'closing':
                if (ear < blinkThreshold) {
                    this.state.eyeClosedFrames++;
                } else {
                    // Eye opened again - blink complete!
                    if (this.state.eyeClosedFrames >= 1) {
                        blinkJustDetected = true;
                        this.state.blinkCount++;
                        this.state.blinkDetected = true;
                        console.log(`[Liveness] Blink detected! Count: ${this.state.blinkCount}, Baseline: ${this.state.baseline.toFixed(3)}, Drop: ${ear.toFixed(3)}`);
                    }
                    this.state.blinkPhase = 'open';
                    this.state.eyeClosedFrames = 0;
                }
                break;
        }

        this.state.lastEAR = ear;
        return blinkJustDetected;
    }

    /**
     * Estimate head rotation direction based on nose position relative to cheeks
     * Returns 'left', 'right', or 'center'
     */
    public detectHeadRotation(landmarks: Point[]): 'left' | 'right' | 'center' {
        if (landmarks.length < 68) return 'center';

        const noseTip = landmarks[NOSE_TIP_INDEX];
        const leftCheek = landmarks[LEFT_CHEEK_INDEX];
        const rightCheek = landmarks[RIGHT_CHEEK_INDEX];

        const distToLeft = this.distance(noseTip, leftCheek);
        const distToRight = this.distance(noseTip, rightCheek);

        // Ratio of distances - if equal, head is centered
        const ratio = distToLeft / distToRight;

        // Thresholds tuned empirically
        if (ratio < 0.75) {
            return 'left'; // Nose closer to left cheek = head turned left
        } else if (ratio > 1.35) {
            return 'right'; // Nose closer to right cheek = head turned right
        }
        return 'center';
    }

    /**
     * Get current liveness state
     */
    public getState(): Readonly<LivenessState> {
        return { ...this.state };
    }

    /**
     * Check if liveness has been verified (at least one blink detected)
     */
    public isLive(): boolean {
        return this.state.blinkDetected;
    }

    /**
     * Get number of blinks detected
     */
    public getBlinkCount(): number {
        return this.state.blinkCount;
    }

    /**
     * Get current EAR value (useful for UI feedback)
     */
    public getCurrentEAR(): number {
        return this.state.lastEAR;
    }

    /**
     * Get current baseline EAR
     */
    public getBaseline(): number {
        return this.state.baseline;
    }

    /**
     * Reset the detector state for a new session
     */
    public reset(): void {
        this.state = {
            earHistory: [],
            blinkDetected: false,
            blinkCount: 0,
            eyeClosedFrames: 0,
            lastEAR: 1.0,
            baseline: 0,
            blinkPhase: 'open',
        };
    }
}

// Singleton export for convenience
let instance: LivenessDetector | null = null;

export function getLivenessDetector(): LivenessDetector {
    if (!instance) {
        instance = new LivenessDetector();
    }
    return instance;
}

export function resetLivenessDetector(): void {
    instance?.reset();
}
