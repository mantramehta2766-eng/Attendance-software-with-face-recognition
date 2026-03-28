import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { FileText, Search, Filter, Download, Trash2, Calendar as CalendarIcon, User, Users, Loader2 } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AttendanceRecord } from '../types';

export default function AttendanceReports({ isAdmin }: { isAdmin: boolean }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    class: '',
    studentName: ''
  });

  useEffect(() => {
    setLoading(true);
    let q = query(
      collection(db, 'attendance'),
      where('date', '==', filters.date)
      // Removed orderBy timestamp to avoid composite index requirement
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      
      // Sort client-side instead
      data.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
      
      // Client-side filtering for class and name (Firestore doesn't support partial string match easily without external tools)
      if (filters.class) {
        data = data.filter(r => r.class.toLowerCase().includes(filters.class.toLowerCase()));
      }
      if (filters.studentName) {
        data = data.filter(r => r.studentName.toLowerCase().includes(filters.studentName.toLowerCase()));
      }
      
      setRecords(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => unsubscribe();
  }, [filters.date, filters.class, filters.studentName]);

  const handleDelete = async () => {
    if (!isAdmin || !confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'attendance');
    }
  };

  const exportToCSV = () => {
    const headers = ['Student Name', 'Roll Number', 'Class', 'Date', 'Time', 'Status'];
    const rows = records.map(r => [
      r.studentName,
      r.rollNumber,
      r.class,
      r.date,
      format(r.timestamp.toDate(), 'hh:mm a'),
      r.status
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${filters.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Attendance Reports</h1>
          <p className="text-gray-500 mt-1">View and manage attendance history.</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={records.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl hover:bg-gray-50 transition-all font-bold shadow-sm border border-gray-200 disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.date}
                onChange={e => setFilters({ ...filters, date: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class/Dept</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by class..."
                value={filters.class}
                onChange={e => setFilters({ ...filters, class: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Student Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student..."
                value={filters.studentName}
                onChange={e => setFilters({ ...filters, studentName: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                {isAdmin && <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p className="text-sm font-medium">No records found for this selection.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <motion.tr 
                    key={record.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {record.studentName.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{record.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{record.rollNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.class}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{format(record.timestamp.toDate(), 'hh:mm a')}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                        record.status === 'present' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {record.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setConfirmDelete(record.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
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
              <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Record?</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Are you sure you want to delete this attendance record? 
                This action is permanent.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl hover:bg-gray-200 transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all font-bold shadow-lg shadow-red-100"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
