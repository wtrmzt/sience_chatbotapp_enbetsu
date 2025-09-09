import { db } from '../../../lib/firebase';
import { Lesson, Topic, Problem } from '../../../types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { NextResponse } from 'next/server';

// Helper function to fetch subcollections
async function getSubcollection<T>(path: string): Promise<T[]> {
  const q = query(collection(db, path), orderBy('title', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

// GET: Fetch all worksheets data
export async function GET() {
  try {
    const lessonsCollection = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(query(lessonsCollection, orderBy('name', 'asc')));
    const lessons: Lesson[] = [];

    for (const lessonDoc of lessonsSnapshot.docs) {
      const lessonData = lessonDoc.data();
      const lesson: Lesson = {
        id: lessonDoc.id,
        name: lessonData.name,
        topics: [],
      };

      const topicsSnapshot = await getDocs(query(collection(db, `lessons/${lessonDoc.id}/topics`), orderBy('name', 'asc')));
      for (const topicDoc of topicsSnapshot.docs) {
        const topicData = topicDoc.data();
        const topic: Topic = {
          id: topicDoc.id,
          name: topicData.name,
          problems: [],
        };

        const problemsSnapshot = await getDocs(query(collection(db, `lessons/${lessonDoc.id}/topics/${topicDoc.id}/problems`), orderBy('title', 'asc')));
        topic.problems = problemsSnapshot.docs.map(problemDoc => ({
          id: problemDoc.id,
          ...problemDoc.data(),
        } as Problem));
        
        lesson.topics.push(topic);
      }
      lessons.push(lesson);
    }

    return NextResponse.json(lessons);
  } catch (error: any) {
    console.error("Error fetching worksheets: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add new lesson, topic, or problem
export async function POST(request: Request) {
  try {
    const { type, payload, parentIds } = await request.json();

    let newDocRef;
    if (type === 'lesson') {
      newDocRef = await addDoc(collection(db, 'lessons'), { name: payload.name });
    } else if (type === 'topic' && parentIds?.lessonId) {
      newDocRef = await addDoc(collection(db, `lessons/${parentIds.lessonId}/topics`), { name: payload.name });
    } else if (type === 'problem' && parentIds?.lessonId && parentIds?.topicId) {
      newDocRef = await addDoc(collection(db, `lessons/${parentIds.lessonId}/topics/${parentIds.topicId}/problems`), payload);
    } else {
      throw new Error('Invalid type or missing parent IDs');
    }
    
    return NextResponse.json({ id: newDocRef.id, ...payload });
  } catch (error: any) {
    console.error("Error adding document: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update an existing problem
export async function PUT(request: Request) {
  try {
    const { problem, parentIds } = await request.json();
    if (!problem || !problem.id || !parentIds?.lessonId || !parentIds?.topicId) {
      throw new Error('Invalid data for updating problem');
    }
    const problemRef = doc(db, `lessons/${parentIds.lessonId}/topics/${parentIds.topicId}/problems`, problem.id);
    await updateDoc(problemRef, {
        title: problem.title,
        question: problem.question,
        prompt: problem.prompt,
    });
    return NextResponse.json({ message: 'Problem updated successfully' });
  } catch (error: any) {
    console.error("Error updating problem: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
