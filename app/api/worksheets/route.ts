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

// GET: 全ての科目・授業・設問データを階層構造で取得
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

// POST: 新しい科目、授業、または設問を追加
export async function POST(request: Request) {
  try {
    const { type, payload, parentIds } = await request.json();

    let newDocRef;
    if (type === 'lesson') { // 科目の追加
      newDocRef = await addDoc(collection(db, 'lessons'), { name: payload.name });
    } else if (type === 'topic' && parentIds?.lessonId) { // 授業の追加
      newDocRef = await addDoc(collection(db, `lessons/${parentIds.lessonId}/topics`), { name: payload.name });
    } else if (type === 'problem' && parentIds?.lessonId && parentIds?.topicId) { // 設問の追加
      const newProblem = {
        title: payload.title || '新しい設問',
        question: payload.question || '最初の問いかけを編集してください。',
        prompt: payload.prompt || 'プロンプトを編集してください。',
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

// PUT: 既存の設問を更新 (最初の問いかけ、プロンプトなど)
export async function PUT(request: Request) {
  try {
    const { problem, parentIds } = await request.json();
    if (!problem || !problem.id || !parentIds?.lessonId || !parentIds?.topicId) {
      throw new Error('Invalid data for updating problem');
    }
    const problemRef = doc(db, `lessons/${parentIds.lessonId}/topics/${parentIds.topicId}/problems`, problem.id);
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

// DELETE: 科目、授業、または設問を削除 (関連データも再帰的に削除)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const lessonId = searchParams.get('lessonId');
    const topicId = searchParams.get('topicId');
    const problemId = searchParams.get('problemId');

    if (type === 'problem' && lessonId && topicId && problemId) { // 設問の削除
      await deleteDoc(doc(db, `lessons/${lessonId}/topics/${topicId}/problems`, problemId));
    } else if (type === 'topic' && lessonId && topicId) { // 授業の削除
      const problemsSnapshot = await getDocs(collection(db, `lessons/${lessonId}/topics/${topicId}/problems`));
      for (const problemDoc of problemsSnapshot.docs) {
        await deleteDoc(problemDoc.ref);
      }
      await deleteDoc(doc(db, `lessons/${lessonId}/topics`, topicId));
    } else if (type === 'lesson' && lessonId) { // 科目の削除
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