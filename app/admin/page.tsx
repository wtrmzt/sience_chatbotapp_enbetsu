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


export default function AdminPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [formData, setFormData] = useState<Omit<Problem, 'id'>>({ title: '', question: '', prompt: '' });
  const [isLoading, setIsLoading] = useState(true);

  // データの初期読み込み
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/api/worksheets', 'GET');
      // データをクライアント側で並び替え
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

  useEffect(() => {
    if (selectedProblem) {
      setFormData({
        title: selectedProblem.title,
        question: selectedProblem.question,
        prompt: selectedProblem.prompt,
      });
    } else {
      setFormData({ title: '', question: '', prompt: '' });
    }
  }, [selectedProblem]);

  // --- イベントハンドラ ---

  const handleAdd = async (type: 'lesson' | 'topic' | 'problem') => {
    let name: string | null = '';
    if (type === 'lesson' || type === 'topic') {
        name = prompt(`新しい${type === 'lesson' ? '科目' : '授業'}の名前を入力してください:`);
        if (!name) return;
    }

    try {
        let payload: any = {};
        let parentIds: any = {};

        if (type === 'lesson') payload = { name };
        if (type === 'topic') {
            payload = { name };
            parentIds = { lessonId: selectedLesson?.id };
        }
        if (type === 'problem') {
            payload = { title: '新しい設問', question: '', prompt: '' };
            parentIds = { lessonId: selectedLesson?.id, topicId: selectedTopic?.id };
        }
        
        await apiRequest('/api/worksheets', 'POST', { type, payload, parentIds });
        fetchData(); // データを再読み込みしてUIを更新
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

  const handleDelete = async (type: 'lesson' | 'topic' | 'problem', id: string) => {
    if (!confirm(`${type}「${id}」を削除しますか？関連するデータもすべて削除されます。`)) return;

    try {
      const params = new URLSearchParams({
        type,
        lessonId: selectedLesson?.id || '',
        topicId: selectedTopic?.id || '',
        problemId: id
      });
      await apiRequest(`/api/worksheets?${params.toString()}`, 'DELETE');
      
      // 選択状態をリセット
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">教員用管理ページ</h1>
        
        {isLoading ? (
            <p>データを読み込んでいます...</p>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 科目 Column */}
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">科目</h2>
                        <button onClick={() => handleAdd('lesson')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>
                    </div>
                    <ul className="space-y-2">
                        {lessons.map(lesson => (
                            <li key={lesson.id} onClick={() => { setSelectedLesson(lesson); setSelectedTopic(null); setSelectedProblem(null); }} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedLesson?.id === lesson.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                <span>{lesson.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('lesson', lesson.id); }} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 授業 Column */}
                <div className="bg-white p-4 rounded-lg shadow">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">授業</h2>
                        {selectedLesson && <button onClick={() => handleAdd('topic')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>}
                    </div>
                    {selectedLesson && (
                        <ul className="space-y-2">
                            {selectedLesson.topics.map(topic => (
                                <li key={topic.id} onClick={() => { setSelectedTopic(topic); setSelectedProblem(null); }} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedTopic?.id === topic.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                    <span>{topic.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('topic', topic.id); }} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* 設問 & 編集フォーム Column */}
                <div className="bg-white p-4 rounded-lg shadow md:col-span-1">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">設問</h2>
                        {selectedTopic && <button onClick={() => handleAdd('problem')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">+</button>}
                    </div>
                    {selectedTopic && (
                        <div>
                            <ul className="space-y-2 mb-6">
                                {selectedTopic.problems.map(problem => (
                                    <li key={problem.id} onClick={() => setSelectedProblem(problem)} className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedProblem?.id === problem.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                        <span className="truncate">{problem.title}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete('problem', problem.id); }} className="text-red-500 hover:text-red-700 text-xs ml-2">削除</button>
                                    </li>
                                ))}
                            </ul>

                            {selectedProblem && (
                                <form onSubmit={handleUpdateProblem} className="space-y-4 border-t pt-6">
                                    <div>
                                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">設問</label>
                                        <input type="text" id="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="question" className="block text-sm font-medium text-gray-700">最初の問いかけ</label>
                                        <textarea id="question" rows={3} value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                    </div>
                                     <div>
                                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">プロンプト内容</label>
                                        <textarea id="prompt" rows={10} value={formData.prompt} onChange={e => setFormData({...formData, prompt: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono" />
                                    </div>
                                    <button type="submit" className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600">保存する</button>
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