/**
 * Face Recognition Service with Dynamic Import
 * 
 * Uses dynamic import for @vladmandic/face-api to prevent bundling
 * the heavy library (~3MB) in the main application chunk.
 * The library is only loaded when face recognition is actually needed.
 */

const MODEL_URL = '/models';

// Type for the dynamically imported module
type FaceApiModule = typeof import('@vladmandic/face-api');

export class FaceService {
    private static instance: FaceService;
    private modelsLoaded = false;
    private loadPromise: Promise<void> | null = null;
    private faceapi: FaceApiModule | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): FaceService {
        if (!FaceService.instance) {
            FaceService.instance = new FaceService();
        }
        return FaceService.instance;
    }

    /**
     * Dynamically imports face-api library
     */
    private async loadFaceApi(): Promise<FaceApiModule> {
        if (this.faceapi) return this.faceapi;

        console.log('[FaceService] Loading face-api library...');
        this.faceapi = await import('@vladmandic/face-api');
        console.log('[FaceService] face-api library loaded');
        return this.faceapi;
    }

    public async loadModels() {
        if (this.modelsLoaded) return;

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = (async () => {
            console.log('[FaceService] Loading models...');
            try {
                const faceapi = await this.loadFaceApi();
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // High accuracy detector
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), // High speed detector (for liveness)
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // Landmarks
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), // Tiny Landmarks (faster)
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // Descriptors
                ]);
                this.modelsLoaded = true;
                console.log('[FaceService] Models loaded successfully');
            } catch (error) {
                console.error('[FaceService] Error loading models:', error);
                this.loadPromise = null;
                throw error;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Initialize backend and warmup models to prevent lag on first use
     */
    public async initializeWithWarmup() {
        if (!this.faceapi) await this.loadFaceApi();
        const faceapi = this.faceapi!;

        // 1. Set Backend
        try {
            await (faceapi.tf as any).setBackend('webgl');
            console.log('[FaceService] Using WebGL backend');
        } catch {
            await (faceapi.tf as any).setBackend('wasm');
            console.log('[FaceService] Using WASM backend');
        }
        await (faceapi.tf as any).ready();

        // 2. Load Models
        await this.loadModels();

        // 3. Warmup Inference (compiles shaders)
        console.log('[FaceService] Warming up models...');
        const dummyInput = faceapi.tf.zeros([1, 224, 224, 3]);
        // We just run a detection on dummy tensor if API supports or just rely on model loading
        // Actually face-api detectSingleFace expects DOM element usually.
        // But we can create a dummy canvas.
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 224;
            canvas.height = 224;
            // Run a simple detection
            try {
                await faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }));
                console.log('[FaceService] Warmup complete');
            } catch (e) {
                console.warn('[FaceService] Warmup inference skipped:', e);
            }
        }
        dummyInput.dispose();
    }

    /**
     * Detects a face and returns its 128-float descriptor
     */
    public async getFaceDescriptor(videoOrImage: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<Float32Array | null> {
        if (!this.modelsLoaded) await this.loadModels();

        const faceapi = this.faceapi!;
        // Using SSD MobileNet V1 for better accuracy than TinyFace
        const detection = await faceapi.detectSingleFace(videoOrImage, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) return null;
        return detection.descriptor;
    }

    /**
     * Compute Euclidean Distance between two face descriptors
     * @param descriptor1 Float32Array
     * @param descriptor2 Float32Array
     * @returns distance (lower is closer)
     */
    public async compareFaces(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): Promise<number> {
        if (!this.faceapi) await this.loadFaceApi();
        return this.faceapi!.euclideanDistance(descriptor1, descriptor2);
    }

    /**
     * Helper to verify a match based on a threshold
     * Custom threshold: 0.6 is good for SSD MobileNet, 0.4 for Tiny
     */
    public async isMatch(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[], threshold = 0.55): Promise<boolean> {
        const distance = await this.compareFaces(descriptor1, descriptor2);
        return distance < threshold;
    }

    public getModelsLoaded() {
        return this.modelsLoaded;
    }

    /**
     * Average multiple descriptors into one to create a more robust reference
     */
    public averageDescriptors(descriptors: Float32Array[]): Float32Array {
        if (descriptors.length === 0) throw new Error('No descriptors to average');
        const length = descriptors[0].length;
        const avg = new Float32Array(length);

        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (const d of descriptors) {
                sum += d[i];
            }
            avg[i] = sum / descriptors.length;
        }
        return avg;
    }
}
