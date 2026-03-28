import React, { Component, useState, useEffect, Suspense, lazy } from 'react';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { LogIn, LogOut, Users, UserPlus, Camera, FileText, LayoutDashboard, Loader2, AlertCircle, Menu, X, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Lazy load components
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const StudentEnrollment = lazy(() => import('./components/StudentEnrollment'));
const StudentManagement = lazy(() => import('./components/StudentManagement'));
const AttendanceMarker = lazy(() => import('./components/AttendanceMarker'));
const AttendanceReports = lazy(() => import('./components/AttendanceReports'));

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  public state: any = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let errorDetail = null;

      try {
        // Try to parse the JSON error info from Firestore
        const parsed = JSON.parse(this.state.error?.message || '');
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.operationType}`;
          errorDetail = parsed.error;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-2 font-medium">{errorMessage}</p>
            {errorDetail && (
              <p className="text-xs text-red-400 mb-6 bg-red-50 p-3 rounded-lg break-all">
                {errorDetail}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'enroll' | 'manage' | 'mark' | 'reports'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is admin (mantramehta2766@gmail.com)
        setIsAdmin(currentUser.email === 'mantramehta2766@gmail.com');
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-200">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">FaceAttendance Pro</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">
            The next generation of attendance tracking for modern educational institutions.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all transform hover:scale-[1.02] active:scale-[0.98] font-semibold"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          <p className="mt-8 text-xs text-gray-400">
            Secure, fast, and reliable face recognition technology.
          </p>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'mark', label: 'Mark Attendance', icon: Camera, show: true },
    { id: 'enroll', label: 'Enroll Student', icon: UserPlus, show: isAdmin },
    { id: 'manage', label: 'Manage Students', icon: GraduationCap, show: isAdmin },
    { id: 'reports', label: 'Reports', icon: FileText, show: true },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] flex relative overflow-hidden">
        {/* Sidebar Overlay for Mobile */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <motion.nav
          initial={false}
          animate={{ 
            x: isSidebarOpen ? 0 : -300,
            width: isSidebarOpen ? 288 : 0,
            opacity: isSidebarOpen ? 1 : 0
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            "fixed md:relative z-50 h-screen bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0",
            !isSidebarOpen && "md:border-none"
          )}
        >
          <div className="w-72 flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 tracking-tight">FaceAttendance</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              {navItems.filter(item => item.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                    activeTab === item.id 
                      ? "bg-blue-50 text-blue-700 shadow-sm" 
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-blue-600" : "text-gray-400")} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3 px-2 mb-6">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt={user.displayName || 'User'} 
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{isAdmin ? 'Administrator' : 'Staff'}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </motion.nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 z-30">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                {navItems.find(i => i.id === activeTab)?.label}
              </span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-6xl mx-auto"
              >
                <Suspense fallback={
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                }>
                  {activeTab === 'dashboard' && <AdminDashboard isAdmin={isAdmin} />}
                  {activeTab === 'enroll' && <StudentEnrollment />}
                  {activeTab === 'manage' && <StudentManagement />}
                  {activeTab === 'mark' && <AttendanceMarker />}
                  {activeTab === 'reports' && <AttendanceReports isAdmin={isAdmin} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
