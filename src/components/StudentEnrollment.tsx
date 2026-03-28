import React, { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Camera, UserPlus, CheckCircle, Loader2, RefreshCcw, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { loadModels, getFaceDescriptor, serializeDescriptor } from '../services/faceService';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function StudentEnrollment() {
  const [formData, setFormData] = useState({ name: '', rollNumber: '', class: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedDescriptors, setCapturedDescriptors] = useState<Float32Array[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('Initializing face recognition models for enrollment...');
        await loadModels();
        setIsModelsLoaded(true);
        console.log('Models loaded successfully for enrollment');
      } catch (err) {
        console.error('Failed to load face recognition models:', err);
        setError('Failed to load face recognition models. Please check your internet connection.');
      }
    };
    init();
  }, []);

  const startCamera = async () => {
    setIsModalOpen(true);
    setError(null);
    // Camera will be started in useEffect when modal opens
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      if (isModalOpen && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, facingMode: facingMode } 
          });
          videoRef.current.srcObject = stream;
        } catch (err) {
          setError('Could not access camera. Please ensure you have granted permission.');
          setIsModalOpen(false);
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isModalOpen, facingMode]);

  const captureFace = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) return;
    
    setIsCapturing(true);
    setError(null);
    
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
        // Capture a frame for preview
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            setPreviewImages(prev => [...prev, canvas.toDataURL('image/jpeg')]);
          }
        }
        
        setCapturedDescriptors(prev => [...prev, descriptor]);
        if (capturedDescriptors.length + 1 >= 3) {
          setIsModalOpen(false);
        }
      } else {
        setError('No face detected. Please position your face clearly in the frame.');
      }
    } catch (err) {
      setError('Error during face detection. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capturedDescriptors.length === 0) {
      setError('Please capture at least one face sample.');
      return;
    }

    setIsEnrolling(true);
    try {
      await addDoc(collection(db, 'students'), {
        ...formData,
        faceDescriptors: capturedDescriptors.map(d => serializeDescriptor(d)),
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setFormData({ name: '', rollNumber: '', class: '' });
      setCapturedDescriptors([]);
      setPreviewImages([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    } finally {
      setIsEnrolling(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-xl text-center border border-green-100"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enrollment Successful!</h2>
        <p className="text-gray-500 mb-8">The student has been successfully registered in the system.</p>
        <button
          onClick={() => setSuccess(false)}
          className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
        >
          Enroll Another Student
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Student Enrollment</h1>
          <p className="text-gray-500 mt-1">Register a new student with face recognition data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <form onSubmit={handleEnroll} className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={formData.rollNumber}
                    onChange={e => setFormData({ ...formData, rollNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="S12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Class/Dept</label>
                  <input
                    type="text"
                    required
                    value={formData.class}
                    onChange={e => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="CS-A"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={capturedDescriptors.length === 0 || isEnrolling}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-blue-100"
              >
                {isEnrolling ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                Complete Enrollment
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Face Samples ({capturedDescriptors.length}/3)</h3>
            
            <div className="grid grid-cols-3 gap-2 mb-6 w-full">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="relative aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center group">
                  {previewImages[idx] ? (
                    <>
                      <img src={previewImages[idx]} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {
                          setPreviewImages(prev => prev.filter((_, i) => i !== idx));
                          setCapturedDescriptors(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-6 h-6 opacity-20 text-gray-400" />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={startCamera}
              disabled={!isModelsLoaded || capturedDescriptors.length >= 3}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all font-bold disabled:opacity-50"
            >
              {isModelsLoaded ? <Camera className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              {capturedDescriptors.length > 0 ? 'Add Sample' : 'Open Camera'}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[85vh] md:h-auto"
            >
              <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 flex gap-2">
                <button 
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  className="p-3 md:p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-xl md:rounded-2xl transition-all shadow-lg"
                  title="Switch Camera"
                >
                  <RefreshCcw className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 md:p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-xl md:rounded-2xl transition-all shadow-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative flex-1 md:aspect-[16/10] bg-black overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Face Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[240px] h-[320px] md:w-[300px] md:h-[400px] border-2 border-dashed border-white/50 rounded-[3rem] md:rounded-[4rem] relative shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]">
                    <div className="absolute inset-0 border-2 border-white/20 rounded-[3rem] md:rounded-[4rem] scale-105" />
                    <div className="absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md px-3 md:px-4 py-1 rounded-full text-white text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                      Align Face Here
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isCapturing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex items-center justify-center z-30"
                    >
                      <div className="bg-white px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-3xl shadow-2xl flex items-center gap-3 md:gap-4">
                        <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-blue-600 animate-spin" />
                        <span className="font-black text-blue-600 text-base md:text-lg uppercase tracking-wider">Analyzing Face...</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 md:p-8 flex flex-col items-center gap-4 md:gap-6 shrink-0 bg-white">
                <div className="text-center">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">Capture Face Sample {capturedDescriptors.length + 1}/3</h3>
                  <p className="text-xs md:text-sm text-gray-500">Position the student's face within the guide and click capture.</p>
                </div>

                <button
                  onClick={captureFace}
                  disabled={isCapturing}
                  className="w-full max-w-xs flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl hover:bg-blue-700 transition-all font-bold text-base md:text-lg shadow-xl shadow-blue-100 disabled:opacity-50"
                >
                  {isCapturing ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Camera className="w-5 h-5 md:w-6 md:h-6" />}
                  {isCapturing ? 'Capturing...' : 'Take Photo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
