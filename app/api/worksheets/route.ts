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
  query
} from 'firebase/firestore';
import { NextResponse } from 'next/server';

// GET: Fetch all worksheets data
// Note: Removed orderBy to prevent Firestore indexing issues. Sorting is handled client-side.
export async function GET() {
  try {
    const lessonsCollection = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsCollection);
    const lessons: Lesson[] = [];

    for (const lessonDoc of lessonsSnapshot.docs) {
      const lessonData = lessonDoc.data();
      const lesson: Lesson = {
        id: lessonDoc.id,
        name: lessonData.name,
        topics: [],
      };

      const topicsSnapshot = await getDocs(collection(db, `lessons/${lessonDoc.id}/topics`));
      for (const topicDoc of topicsSnapshot.docs) {
        const topicData = topicDoc.data();
        const topic: Topic = {
          id: topicDoc.id,
          name: topicData.name,
          problems: [],
        };

        const problemsSnapshot = await getDocs(collection(db, `lessons/${lessonDoc.id}/topics/${topicDoc.id}/problems`));
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
      // Ensure all required fields for a problem are present
      const newProblem = {
        title: payload.title || '新しい設問',
        question: payload.question || '',
        prompt: payload.prompt || '',
      };
      newDocRef = await addDoc(collection(db, `lessons/${parentIds.lessonId}/topics/${parentIds.topicId}/problems`), newProblem);
      return NextResponse.json({ id: newDocRef.id, ...newProblem });
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
    // Ensure we only update the fields that are allowed to be changed
    const updatedData = {
        title: problem.title,
        question: problem.question,
        prompt: problem.prompt,
    };
    await updateDoc(problemRef, updatedData);
    return NextResponse.json({ message: 'Problem updated successfully' });
  } catch (error: any) {
    console.error("Error updating problem: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a lesson, topic, or problem
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const lessonId = searchParams.get('lessonId');
    const topicId = searchParams.get('topicId');
    const problemId = searchParams.get('problemId');

    if (type === 'problem' && lessonId && topicId && problemId) {
      await deleteDoc(doc(db, `lessons/${lessonId}/topics/${topicId}/problems`, problemId));
    } else if (type === 'topic' && lessonId && topicId) {
      const problemsSnapshot = await getDocs(collection(db, `lessons/${lessonId}/topics/${topicId}/problems`));
      for (const problemDoc of problemsSnapshot.docs) {
        await deleteDoc(problemDoc.ref);
      }
      await deleteDoc(doc(db, `lessons/${lessonId}/topics`, topicId));
    } else if (type === 'lesson' && lessonId) {
      const topicsSnapshot = await getDocs(collection(db, `lessons/${lessonId}/topics`));
      for (const topicDoc of topicsSnapshot.docs) {
        const problemsSnapshot = await getDocs(collection(db, `lessons/${lessonId}/topics/${topicDoc.id}/problems`));
        for (const problemDoc of problemsSnapshot.docs) {
            await deleteDoc(problemDoc.ref);
        }
        await deleteDoc(topicDoc.ref);
      }
      await deleteDoc(doc(db, 'lessons', lessonId));
    } else {
      throw new Error('Invalid type or missing IDs for deletion');
    }

    return NextResponse.json({ message: `${type} deleted successfully` });
  } catch (error: any) {
    console.error(`Error deleting document: `, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}