'use client';

import { useState, useEffect } from 'react';
import type { Lesson, Topic, Problem } from '../../types';

// --- Icon Components ---
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const SaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414L11 11.586l-2.293-2.293z" /><path d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1H3zm12 1H5v10h10V4z" /></svg>;

// --- Main Admin Page Component ---
export default function AdminPage() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
    const [currentParentIds, setCurrentParentIds] = useState<{lessonId: string, topicId: string} | null>(null);

    // Fetch initial data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/worksheets');
            if (!res.ok) throw new Error('Failed to fetch data');
            const data = await res.json();
            setLessons(data);
        } catch (error) {
            console.error(error);
            alert('データの読み込みに失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    // Handlers
    const handleEditClick = (problem: Problem, lessonId: string, topicId: string) => {
        setEditingProblem({ ...problem });
        setCurrentParentIds({ lessonId, topicId });
    };

    const handleSave = async () => {
        if (!editingProblem || !currentParentIds) return;
        try {
            const res = await fetch('/api/worksheets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problem: editingProblem, parentIds: currentParentIds }),
            });
            if (!res.ok) throw new Error('Failed to save data');
            await fetchData(); // Re-fetch data to show changes
            setEditingProblem(null);
            setCurrentParentIds(null);
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。');
        }
    };

    const handleAddNew = async (type: 'lesson' | 'topic' | 'problem', parentIds?: {lessonId?: string, topicId?: string}) => {
        const name = prompt(`新しい${type}の名前を入力してください:`);
        if(!name) return;

        let payload: any = { name };
        let apiType = type;

        if (type === 'problem') {
             payload = { title: name, question: '新しい質問', prompt: '新しいプロンプト' };
        }

        try {
            const res = await fetch('/api/worksheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: apiType, payload, parentIds }),
            });
            if (!res.ok) throw new Error('Failed to add new item');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('追加に失敗しました。');
        }
    };

    if (isLoading) return <div className="p-8 text-center">データを読み込んでいます...</div>;

    return (
        <div className="font-sans bg-gray-50 min-h-screen">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">教員用管理ページ</h1>
                    <button onClick={() => handleAddNew('lesson')} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition">
                        <PlusIcon /> 新しいレッスンを追加
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-8">
                <div className="space-y-6">
                    {lessons.map(lesson => (
                        <div key={lesson.id} className="bg-white border border-gray-200 rounded-lg shadow">
                            <div className="p-4 bg-gray-100 border-b rounded-t-lg flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-700">{lesson.name}</h2>
                                <button onClick={() => handleAddNew('topic', { lessonId: lesson.id })} className="flex items-center gap-1 text-sm bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 transition">
                                    <PlusIcon /> トピックを追加
                                </button>
                            </div>
                            <div className="space-y-4 p-4">
                                {lesson.topics.map(topic => (
                                    <div key={topic.id} className="border border-gray-200 rounded-md">
                                        <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                                            <h3 className="font-medium text-gray-600">{topic.name}</h3>
                                            <button onClick={() => handleAddNew('problem', { lessonId: lesson.id, topicId: topic.id })} className="flex items-center gap-1 text-xs bg-indigo-500 text-white px-2 py-1 rounded-md hover:bg-indigo-600 transition">
                                                <PlusIcon /> 問題を追加
                                            </button>
                                        </div>
                                        <ul className="divide-y divide-gray-200">
                                            {topic.problems.map(problem => (
                                                <li key={problem.id} className="p-3 flex justify-between items-center">
                                                    <span className="text-gray-800">{problem.title}</span>
                                                    <button onClick={() => handleEditClick(problem, lesson.id, topic.id)} className="text-gray-500 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100 transition">
                                                        <EditIcon />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
            
            {/* --- Editing Modal --- */}
            {editingProblem && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b">
                            <h2 className="text-xl font-bold">プロンプト編集</h2>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                                <input type="text" value={editingProblem.title} onChange={e => setEditingProblem({...editingProblem, title: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">初期質問</label>
                                <textarea value={editingProblem.question} onChange={e => setEditingProblem({...editingProblem, question: e.target.value})} rows={3} className="w-full border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">AIへの指示 (プロンプト)</label>
                                <textarea value={editingProblem.prompt} onChange={e => setEditingProblem({...editingProblem, prompt: e.target.value})} rows={10} className="w-full border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm" />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                             <button onClick={() => setEditingProblem(null)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">キャンセル</button>
                             <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                <SaveIcon /> 保存
                            </button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
}
