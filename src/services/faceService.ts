import * as faceapi from 'face-api.js';

const MODEL_URLS = [
  'https://justadudewhohacks.github.io/face-api.js/models',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/'
];

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export const loadModels = async () => {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let lastError = null;
    
    for (const url of MODEL_URLS) {
      try {
        console.log(`Attempting to load face models from: ${url}`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(url),
          faceapi.nets.faceLandmark68Net.loadFromUri(url),
          faceapi.nets.faceRecognitionNet.loadFromUri(url),
        ]);
        modelsLoaded = true;
        console.log('Face models loaded successfully from', url);
        return;
      } catch (error) {
        console.warn(`Failed to load models from ${url}:`, error);
        lastError = error;
      }
    }
    
    loadingPromise = null;
    throw lastError || new Error('All model URLs failed to load');
  })();

  return loadingPromise;
};

export const getFaceDescriptor = async (video: HTMLVideoElement) => {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  
  return detection ? detection.descriptor : null;
};

export const createMatcher = (students: { id: string; descriptors: Float32Array[] }[]) => {
  if (students.length === 0) return null;
  
  const labeledDescriptors = students.map(s => 
    new faceapi.LabeledFaceDescriptors(s.id, s.descriptors)
  );
  
  return new faceapi.FaceMatcher(labeledDescriptors, 0.5);
};

export const serializeDescriptor = (descriptor: Float32Array) => {
  return JSON.stringify(Array.from(descriptor));
};

export const deserializeDescriptor = (serialized: string) => {
  return new Float32Array(JSON.parse(serialized));
};
