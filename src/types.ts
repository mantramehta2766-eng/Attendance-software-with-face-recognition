import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  class: string;
  faceDescriptors: string[]; // Array of serialized Float32Array
  createdAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  class: string;
  date: string; // YYYY-MM-DD
  timestamp: Timestamp;
  status: 'present' | 'absent';
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
}
