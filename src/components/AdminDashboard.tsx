import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, getDocs, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { Users, CheckCircle, XCircle, Clock, TrendingUp, Calendar as CalendarIcon, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface DashboardStats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
}

export default function AdminDashboard({ isAdmin }: { isAdmin: boolean }) {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Listen to total students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const total = snapshot.size;
      
      // Listen to today's attendance
      const q = query(collection(db, 'attendance'), where('date', '==', today));
      const unsubAttendance = onSnapshot(q, (attSnapshot) => {
        const presentIds = new Set(
          attSnapshot.docs
            .filter(doc => doc.data().status === 'present')
            .map(doc => doc.data().studentId)
        );
        const present = presentIds.size;
        const absent = total - present;
        const rate = total > 0 ? (present / total) * 100 : 0;
        
        setStats({
          totalStudents: total,
          presentToday: present,
          absentToday: Math.max(0, absent),
          attendanceRate: Math.round(rate),
        });
        setLoading(false);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));
      
      return () => unsubAttendance();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    return () => unsubStudents();
  }, []);

  const statCards = [
    { label: 'Total Enrolled', value: stats.totalStudents, icon: Users, color: 'blue', trend: '+2% from last month' },
    { label: 'Present Today', value: stats.presentToday, icon: CheckCircle, color: 'green', trend: 'On track' },
    { label: 'Absent Today', value: stats.absentToday, icon: XCircle, color: 'red', trend: 'Follow up needed' },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, color: 'purple', trend: 'Steady' },
  ];

  const handleResetAttendance = async () => {
    if (!isAdmin) return;
    setIsResetting(true);
    setShowResetConfirm(false);
    
    try {
      const snapshot = await getDocs(collection(db, 'attendance'));
      if (snapshot.empty) {
        setIsResetting(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'attendance');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Real-time attendance metrics for {format(new Date(), 'MMMM do, yyyy')}</p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isResetting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold text-sm border border-red-100 disabled:opacity-50"
            >
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reset Data
            </button>
          )}
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{format(new Date(), 'EEEE')}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                stat.color === 'blue' && "bg-blue-50 text-blue-600",
                stat.color === 'green' && "bg-green-50 text-green-600",
                stat.color === 'red' && "bg-red-50 text-red-600",
                stat.color === 'purple' && "bg-purple-50 text-purple-600",
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {stat.trend}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {/* Mock recent activity for visual appeal */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">System Update</p>
                  <p className="text-xs text-gray-500">Attendance records synchronized with cloud storage</p>
                </div>
                <span className="text-xs text-gray-400">2h ago</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Quick Tip</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Ensure proper lighting when marking attendance for the best face recognition accuracy.
            </p>
          </div>
          <div className="mt-8">
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-semibold text-sm backdrop-blur-sm border border-white/20">
              View Documentation
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl border border-gray-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Reset All Data?</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-900">ALL attendance records</span>? 
                This action cannot be undone and will clear the entire history.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl hover:bg-gray-200 transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetAttendance}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all font-bold shadow-lg shadow-red-100"
                >
                  Reset All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
