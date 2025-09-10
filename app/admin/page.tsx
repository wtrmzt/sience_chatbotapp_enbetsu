'use client';

import { useState, useEffect } from 'react';
import type { Lesson, Topic, Problem } from '../../types';

// APIリクエストを送信するためのヘルパー関数
const apiRequest = async (url: string, method: string, body?: any) => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API request failed: ${method} ${url}`);
  }
  return response.json();
};

// ★追加: アイコンコンポーネント
const EyeOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const EyeClosedIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /><path d="M2 10s3.939 4 8 4 8-4 8-4-3.939-4-8-4-8 4-8 4zm10.707-.293a1 1 0 00-1.414-1.414l-4 4a1 1 0 001.414 1.414l4-4z" /></svg>;


export default function AdminPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [formData, setFormData] = useState<Omit<Problem, 'id'>>({ title: '', question: '', prompt: '' , published: false});
  const [isLoading, setIsLoading] = useState(true);

  // データの初期読み込みと並び替え
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/api/worksheets', 'GET');
      data.sort((a: Lesson, b: Lesson) => a.name.localeCompare(b.name, 'ja'));
      data.forEach((lesson: Lesson) => {
        lesson.topics.sort((a: Topic, b: Topic) => a.name.localeCompare(b.name, 'ja'));
        lesson.topics.forEach((topic: Topic) => {
          topic.problems.sort((a: Problem, b: Problem) => a.title.localeCompare(b.title, 'ja'));
        });
      });
      setLessons(data);
    } catch (error) {
      alert(`データの読み込みに失敗しました: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 選択された設問が変わったらフォームの内容を更新
  useEffect(() => {
    if (selectedProblem) {
      setFormData({
        title: selectedProblem.title,
        question: selectedProblem.question,
        prompt: selectedProblem.prompt,
        published: selectedProblem.published
      });
    } else {
      setFormData({ title: '', question: '', prompt: '' , published: false});
    }
  }, [selectedProblem]);

  // --- イベントハンドラ ---

  const handleAdd = async (type: 'lesson' | 'topic' | 'problem') => {
    let name: string | null = '';
    let payload: any = {};
    let parentIds: any = {};

    try {
        if (type === 'lesson') {
            name = prompt(`新しい科目の名前を入力してください:`);
            if (!name) return;
            payload = { name };
        } else if (type === 'topic') {
            if (!selectedLesson) { alert('まず科目を選択してください。'); return; }
            name = prompt(`新しい授業の名前を入力してください:`);
            if (!name) return;
            payload = { name };
            parentIds = { lessonId: selectedLesson.id };
        } else if (type === 'problem') {
            if (!selectedLesson || !selectedTopic) { alert('まず科目と授業を選択してください。'); return; }
            payload = { title: '新しい設問', question: '', prompt: '' };
            parentIds = { lessonId: selectedLesson.id, topicId: selectedTopic.id };
        }
        
        const newItem = await apiRequest('/api/worksheets', 'POST', { type, payload, parentIds });
        
        // ローカルのstateを直接更新して即時反映
        setLessons(prevLessons => {
            const newLessons = JSON.parse(JSON.stringify(prevLessons)); // Deep copy

            if (type === 'lesson') {
                newLessons.push({ ...newItem, topics: [] });
                newLessons.sort((a: Lesson, b: Lesson) => a.name.localeCompare(b.name, 'ja'));
            } else if (type === 'topic' && selectedLesson) {
                const lesson = newLessons.find((l: Lesson) => l.id === selectedLesson.id);
                if (lesson) {
                    lesson.topics.push({ ...newItem, problems: [] });
                    lesson.topics.sort((a: Topic, b: Topic) => a.name.localeCompare(b.name, 'ja'));
                }
            } else if (type === 'problem' && selectedLesson && selectedTopic) {
                const lesson = newLessons.find((l: Lesson) => l.id === selectedLesson.id);
                const topic = lesson?.topics.find((t: Topic) => t.id === selectedTopic.id);
                if (topic) {
                    topic.problems.push(newItem);
                    topic.problems.sort((a: Problem, b: Problem) => a.title.localeCompare(b.title, 'ja'));
                }
            }
            return newLessons;
        });

    } catch (error) {
        alert(`追加に失敗しました: ${(error as Error).message}`);
    }
  };
  
  const handleUpdateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem || !selectedLesson || !selectedTopic) return;
    try {
      await apiRequest('/api/worksheets', 'PUT', {
        problem: { ...formData, id: selectedProblem.id },
        parentIds: { lessonId: selectedLesson.id, topicId: selectedTopic.id },
      });
      alert('更新しました。');
      fetchData();
    } catch (error) {
      alert(`更新に失敗しました: ${(error as Error).message}`);
    }
  };

  
  // ★追加: 公開状態を切り替えるハンドラ
  const handleTogglePublished = async (problem: Problem) => {
    if (!selectedLesson || !selectedTopic) return;
    try {
        const newPublishedState = !problem.published;
        await apiRequest('/api/worksheets', 'PATCH', {
            problemId: problem.id,
            published: newPublishedState,
            parentIds: { lessonId: selectedLesson.id, topicId: selectedTopic.id },
        });

        // UIに即時反映
        const newLessons = [...lessons];
        const lesson = newLessons.find(l => l.id === selectedLesson.id);
        const topic = lesson?.topics.find(t => t.id === selectedTopic.id);
        const p = topic?.problems.find(p => p.id === problem.id);
        if (p) {
          p.published = newPublishedState;
        }
        setLessons(newLessons);
        
    } catch (error) {
        alert(`公開状態の更新に失敗しました: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (type: 'lesson' | 'topic' | 'problem', item: Lesson | Topic | Problem) => {
      const typeName = type === 'lesson' ? '科目' : type === 'topic' ? '授業' : '設問';
      const itemName = 'name' in item ? item.name : item.title;
      if (!confirm(`${typeName}「${itemName}」を削除しますか？\n関連する下位データもすべて削除されます。`)) return;

    try {
      const params = new URLSearchParams({ type });
      if (selectedLesson) params.set('lessonId', selectedLesson.id);
      if (selectedTopic) params.set('topicId', selectedTopic.id);
      if (type === 'problem') params.set('problemId', item.id);
      if (type === 'topic') params.set('topicId', item.id);
      if (type === 'lesson') params.set('lessonId', item.id);
      
      await apiRequest(`/api/worksheets?${params.toString()}`, 'DELETE');
      
      if(type === 'problem') setSelectedProblem(null);
      if(type === 'topic') { setSelectedTopic(null); setSelectedProblem(null); }
      if(type === 'lesson') { setSelectedLesson(null); setSelectedTopic(null); setSelectedProblem(null); }

      fetchData();
    } catch (error) {
      alert(`削除に失敗しました: ${(error as Error).message}`);
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-6">教員用管理ページ</h1>
        
        {isLoading ? <p>データを読み込んでいます...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 科目 Column */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-black">科目</h2>
                        <button onClick={() => handleAdd('lesson')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>
                    </div>
                    <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
                        {lessons.map(lesson => (
                            <li key={lesson.id} onClick={() => { setSelectedLesson(lesson); setSelectedTopic(null); setSelectedProblem(null); }} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedLesson?.id === lesson.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                <span className="text-black">{lesson.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('lesson', lesson); }} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 授業 Column */}
                <div className="bg-white p-4 rounded-lg shadow">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-black">授業</h2>
                        {selectedLesson && <button onClick={() => handleAdd('topic')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>}
                    </div>
                    {selectedLesson && (
                        <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
                            {selectedLesson.topics.map(topic => (
                                <li key={topic.id} onClick={() => { setSelectedTopic(topic); setSelectedProblem(null); }} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedTopic?.id === topic.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                    <span className="text-black">{topic.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('topic', topic); }} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>


                {/* 設問 & 編集フォーム Column */}
                <div className="bg-white p-4 rounded-lg shadow md:col-span-1">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-black">設問</h2>
                        {selectedTopic && <button onClick={() => handleAdd('problem')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>}
                    </div>
                    {selectedTopic && (
                        <div className="max-h-[70vh] overflow-y-auto">
                            <ul className="space-y-2 mb-6">
                                {selectedTopic.problems.map(problem => (
                                    <li key={problem.id} onClick={() => setSelectedProblem(problem)} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedProblem?.id === problem.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                        <span className={`truncate text-black ${!problem.published && 'text-gray-400'}`}>{problem.title}</span>
                                        <div className="flex items-center space-x-2">
                                            {/* ★追加: 公開状態切り替えボタン */}
                                            <button onClick={(e) => { e.stopPropagation(); handleTogglePublished(problem);}} className={problem.published ? 'text-green-500' : 'text-gray-400'}>
                                                {problem.published ? <EyeOpenIcon /> : <EyeClosedIcon />}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete('problem', problem); }} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>


                            {selectedProblem && (
                                <form onSubmit={handleUpdateProblem} className="space-y-4 border-t pt-6">
                                    <div>
                                        <label htmlFor="title" className="block text-sm font-medium text-gray-900">設問</label>
                                        <input type="text" id="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black" required/>
                                    </div>
                                    <div>
                                        <label htmlFor="question" className="block text-sm font-medium text-gray-900">最初の問いかけ</label>
                                        <textarea id="question" rows={3} value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-black" required/>
                                    </div>
                                     <div>
                                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-900">プロンプト内容</label>
                                        <textarea id="prompt" rows={10} value={formData.prompt} onChange={e => setFormData({...formData, prompt: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-black" required/>
                                    </div>
                                    <button type="submit" className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600">この内容で保存する</button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

