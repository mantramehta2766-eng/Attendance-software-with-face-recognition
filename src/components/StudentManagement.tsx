import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, getDocs, where, writeBatch } from 'firebase/firestore';
import { Users, Trash2, Search, User, Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Student } from '../types';

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const q = collection(db, 'students');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id: studentId, name: studentName } = confirmDelete;
    
    setIsDeleting(studentId);
    setConfirmDelete(null);
    try {
      // 1. Delete student document
      await deleteDoc(doc(db, 'students', studentId));
      
      // 2. Delete all attendance records for this student
      const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', studentId));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      if (!attendanceSnapshot.empty) {
        const batch = writeBatch(db);
        attendanceSnapshot.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
      
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Manage Students</h1>
          <p className="text-gray-500 mt-1">View and manage enrolled student profiles.</p>
        </div>
        <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-blue-100 flex items-center gap-3">
          <GraduationCap className="w-6 h-6" />
          <span className="text-xl font-black">{students.length}</span>
          <span className="text-sm font-bold uppercase tracking-wider opacity-80">Total Enrolled</span>
        </div>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, roll number, or class..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-2xl transition-all outline-none text-lg font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Student Info</th>
                <th className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Roll Number</th>
                <th className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Class/Dept</th>
                <th className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Face Data</th>
                <th className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                      <Users className="w-16 h-16 opacity-10" />
                      <p className="text-lg font-bold">No students found matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <motion.tr 
                    key={student.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg shadow-sm">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-lg">{student.name}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Enrolled Student</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-mono text-sm font-bold">
                        {student.rollNumber}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-gray-600 font-bold">{student.class}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {student.faceDescriptors?.map((_, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                          {student.faceDescriptors?.length || 0} Samples
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => setConfirmDelete({ id: student.id, name: student.name })}
                        disabled={isDeleting === student.id}
                        className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-50"
                        title="Delete Student"
                      >
                        {isDeleting === student.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-6 h-6" />
                        )}
                      </button>
                    </td>
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
              <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Student?</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-900">{confirmDelete.name}</span>? 
                This action is permanent and will also delete all their attendance records.
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
