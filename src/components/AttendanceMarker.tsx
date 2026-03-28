import React, { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { Camera, CheckCircle, Loader2, AlertCircle, UserCheck, X, Scan, ShieldCheck, RefreshCcw } from 'lucide-react';
import { loadModels, getFaceDescriptor, createMatcher, deserializeDescriptor } from '../services/faceService';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Student } from '../types';

export default function AttendanceMarker() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [students, setStudents] = useState<Student[]>([]);
  const [matcher, setMatcher] = useState<any>(null);
  const [lastMarked, setLastMarked] = useState<{ name: string; time: string } | null>(null);
  const [recentActivity, setRecentActivity] = useState<{ id: string; name: string; time: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'already_marked' | 'detecting'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('Initializing face recognition engine...');
        await loadModels();
        setIsModelsLoaded(true);
        console.log('Models loaded successfully');
        
        // Fetch students
        console.log('Fetching students from Firestore...');
        const snapshot = await getDocs(collection(db, 'students'));
        const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(studentData);
        console.log(`Found ${studentData.length} students`);
        
        if (studentData.length > 0) {
          const validStudents = studentData.filter(s => s.faceDescriptors && s.faceDescriptors.length > 0);
          console.log(`Found ${validStudents.length} students with face data`);
          
          if (validStudents.length > 0) {
            const descriptors = validStudents.map(s => ({
              id: s.id,
              descriptors: s.faceDescriptors.map(d => deserializeDescriptor(d))
            }));
            const faceMatcher = createMatcher(descriptors);
            setMatcher(faceMatcher);
            console.log('Face matcher initialized');
          } else {
            setError('No students with enrolled face data found. Please enroll students first.');
          }
        } else {
          setError('No students found in database. Please enroll students first.');
        }
      } catch (err) {
        console.error('Failed to initialize face recognition:', err);
        setError('Failed to initialize face recognition. Please check your connection.');
      }
    };
    init();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      // Wait for video ref to be available
      if (!videoRef.current && isModalOpen) {
        setTimeout(enableCamera, 100);
        return;
      }

      if (isModalOpen && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, facingMode: facingMode } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            startRecognition();
          }
        } catch (err) {
          console.error('Camera access error:', err);
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsScanning(false);
    };
  }, [isModalOpen, facingMode]);

  const startRecognition = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScanning(true);
    
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4 || videoRef.current.videoWidth === 0 || !matcher || isProcessing) return;
      
      setIsProcessing(true);
      setStatus('searching');
      
      try {
        const descriptor = await getFaceDescriptor(videoRef.current);
        if (descriptor) {
          setStatus('detecting');
          const match = matcher.findBestMatch(descriptor);
          // Only proceed if match is confident (distance < 0.5)
          if (match.label !== 'unknown' && match.distance < 0.5) {
            await markAttendance(match.label);
          } else {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
      } catch (err) {
        console.error('Recognition error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  const markAttendance = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      // Check if already marked today
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', studentId),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        await addDoc(collection(db, 'attendance'), {
          studentId,
          studentName: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          date: today,
          timestamp: serverTimestamp(),
          status: 'present'
        });
        
        setStatus('found');
        const newRecord = { id: studentId, name: student.name, time: format(new Date(), 'hh:mm a') };
        setLastMarked(newRecord);
        setRecentActivity(prev => [newRecord, ...prev.slice(0, 4)]);
      } else {
        setStatus('already_marked');
      }

      // Pause for 2 seconds to show the result before allowing next scan
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStatus('idle');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">Attendance Scanner</h1>
          <p className="text-gray-500 mt-2 text-lg">Automated face recognition for daily student records.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex flex-col px-4 border-r border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Database</span>
            <span className="text-xl font-black text-blue-600">{students.length} Students</span>
          </div>
          <div className="flex flex-col px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Engine</span>
            <div className="flex items-center gap-2">
              {!matcher && <Loader2 className="w-3 h-3 text-red-600 animate-spin" />}
              <span className={cn("text-sm font-bold", matcher ? "text-green-600" : "text-red-600")}>
                {matcher ? 'READY' : 'LOADING'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center shadow-inner">
            <Scan className="w-12 h-12 text-blue-600" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-gray-900">Start Scanning</h2>
            <p className="text-gray-500 max-w-xs mx-auto">Click the button below to open the camera and mark attendance automatically.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!isModelsLoaded || students.length === 0}
            className="w-full py-6 bg-blue-600 text-white rounded-[2rem] hover:bg-blue-700 transition-all font-black text-2xl shadow-2xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-4 group-hover:scale-[1.02]"
          >
            <Camera className="w-8 h-8" />
            OPEN SCANNER
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px] text-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              {lastMarked ? (
                <motion.div 
                  key="last" 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-6 w-full"
                >
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-10 h-10 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Last Recognized</h3>
                    <p className="text-3xl font-black text-gray-900">{lastMarked.name}</p>
                    <p className="text-sm text-green-600 font-bold mt-2">Successfully marked at {lastMarked.time}</p>
                  </div>

                  {recentActivity.length > 1 && (
                    <div className="pt-6 border-t border-gray-100 w-full">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Activity</h4>
                      <div className="space-y-3">
                        {recentActivity.slice(1).map((activity, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl">
                            <span className="text-sm font-bold text-gray-700">{activity.name}</span>
                            <span className="text-[10px] font-medium text-gray-400">{activity.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-400 space-y-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="font-medium">No activity recorded yet.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <div className="flex items-center gap-4 p-6 bg-red-50 text-red-700 rounded-[2rem] border border-red-100 shadow-sm">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl bg-white rounded-3xl md:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[85vh] md:h-auto"
            >
              <div className="absolute top-6 right-6 md:top-10 md:right-10 z-50 flex gap-3">
                <button 
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  className="p-3 md:p-4 bg-white/90 hover:bg-white text-gray-900 rounded-2xl transition-all shadow-2xl border border-gray-100 flex items-center gap-2"
                  title="Switch Camera"
                >
                  <RefreshCcw className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="hidden md:inline text-xs font-black uppercase tracking-widest">Switch</span>
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 md:p-4 bg-white/90 hover:bg-white text-gray-900 rounded-2xl transition-all shadow-2xl border border-gray-100"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
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
                
                {/* Recognition UI Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-[12px] md:border-[24px] border-black/10" />
                  <motion.div 
                    animate={status === 'detecting' ? { scale: [1, 1.05, 1], opacity: [0.4, 1, 0.4] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className={cn(
                      "absolute top-8 left-8 md:top-16 md:left-16 w-20 h-20 md:w-40 md:h-40 border-t-4 md:border-t-8 border-l-4 md:border-l-8 rounded-tl-2xl md:rounded-tl-[3rem] transition-colors duration-300",
                      status === 'detecting' ? "border-green-500 shadow-[-10px_-10px_30px_rgba(34,197,94,0.6)]" : "border-blue-500 shadow-[-10px_-10px_20px_rgba(59,130,246,0.4)]"
                    )}
                  />
                  <motion.div 
                    animate={status === 'detecting' ? { scale: [1, 1.05, 1], opacity: [0.4, 1, 0.4] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className={cn(
                      "absolute top-8 right-8 md:top-16 md:right-16 w-20 h-20 md:w-40 md:h-40 border-t-4 md:border-t-8 border-r-4 md:border-r-8 rounded-tr-2xl md:rounded-tr-[3rem] transition-colors duration-300",
                      status === 'detecting' ? "border-green-500 shadow-[10px_-10px_30px_rgba(34,197,94,0.6)]" : "border-blue-500 shadow-[10px_-10px_20px_rgba(59,130,246,0.4)]"
                    )}
                  />
                  <motion.div 
                    animate={status === 'detecting' ? { scale: [1, 1.05, 1], opacity: [0.4, 1, 0.4] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className={cn(
                      "absolute bottom-8 left-8 md:bottom-16 md:left-16 w-20 h-20 md:w-40 md:h-40 border-b-4 md:border-b-8 border-l-4 md:border-l-8 rounded-bl-2xl md:rounded-bl-[3rem] transition-colors duration-300",
                      status === 'detecting' ? "border-green-500 shadow-[-10px_10px_30px_rgba(34,197,94,0.6)]" : "border-blue-500 shadow-[-10px_10px_20px_rgba(59,130,246,0.4)]"
                    )}
                  />
                  <motion.div 
                    animate={status === 'detecting' ? { scale: [1, 1.05, 1], opacity: [0.4, 1, 0.4] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className={cn(
                      "absolute bottom-8 right-8 md:bottom-16 md:right-16 w-20 h-20 md:w-40 md:h-40 border-b-4 md:border-b-8 border-r-4 md:border-r-8 rounded-br-2xl md:rounded-br-[3rem] transition-colors duration-300",
                      status === 'detecting' ? "border-green-500 shadow-[10px_10px_30px_rgba(34,197,94,0.6)]" : "border-blue-500 shadow-[10px_10px_20px_rgba(59,130,246,0.4)]"
                    )}
                  />
                </div>

                {isScanning && (
                  <motion.div 
                    animate={{ top: ['20%', '80%', '20%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-10 right-10 md:left-20 md:right-20 h-1 md:h-1.5 bg-blue-500 shadow-[0_0_40px_rgba(59,130,246,1)] z-10 rounded-full"
                  />
                )}

                <div className="absolute bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-5 md:px-8 py-2 md:py-3 rounded-full border border-white/30 flex items-center gap-2 md:gap-4 whitespace-nowrap shadow-2xl z-20">
                  {isProcessing ? (
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 text-blue-400 animate-spin" />
                  ) : (
                    <div className={cn("w-2 h-2 md:w-3 md:h-3 rounded-full", isScanning ? "animate-pulse" : "", status === 'detecting' ? "bg-green-500" : isScanning ? "bg-blue-500" : "bg-gray-500")} />
                  )}
                  <span className="text-white text-[10px] md:text-sm font-black uppercase tracking-[0.1em] md:tracking-[0.2em]">
                    {status === 'detecting' ? 'Face Detected' : isProcessing ? 'Analyzing Face...' : isScanning ? 'Scanning Active' : 'Scanning Stopped'}
                  </span>
                </div>

                <AnimatePresence>
                  {(status === 'found' || status === 'already_marked') && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center z-30 p-4"
                    >
                      <div className={cn(
                        "px-6 md:px-12 py-6 md:py-8 rounded-2xl md:rounded-[3rem] shadow-2xl backdrop-blur-xl border-2 md:border-4 flex flex-col items-center gap-2 md:gap-4 text-center",
                        status === 'found' ? "bg-green-500/90 border-green-400" : "bg-yellow-500/90 border-yellow-400"
                      )}>
                        {status === 'found' ? (
                          <>
                            <CheckCircle className="w-12 h-12 md:w-20 md:h-20 text-white" />
                            <div>
                              <h3 className="text-xl md:text-3xl font-black text-white uppercase mb-1">Recognized</h3>
                              <p className="text-lg md:text-xl font-bold text-white/90">{lastMarked?.name}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-12 h-12 md:w-20 md:h-20 text-white" />
                            <div>
                              <h3 className="text-xl md:text-3xl font-black text-white uppercase mb-1">Already Marked</h3>
                              <p className="text-base md:text-lg font-bold text-white/90">Entry recorded for today</p>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 md:p-12 bg-gray-50 flex flex-col items-center text-center shrink-0">
                <div className="max-w-md">
                  <h3 className="text-lg md:text-2xl font-black text-gray-900 mb-1 md:mb-2 uppercase">Live Recognition</h3>
                  <p className="text-xs md:text-gray-500 font-medium">Position the student's face within the frame. The system will automatically identify and record attendance.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
