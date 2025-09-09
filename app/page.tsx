'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { Lesson, Topic, Problem } from '../types';

// Message型の定義
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// --- アイコンコンポーネント ---
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>;
const BotIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3.5 3.5h-1v-5h1v5z"/></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

export default function ChatbotPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // useChatフックを any で型アサーション
  const chatHelpers = useChat({
    api: '/api/chat',
  } as any);

  // 必要なプロパティを個別に抽出
  const messages: Message[] = (chatHelpers as any).messages || [];
  const input: string = (chatHelpers as any).input || '';
  const handleInputChange = (chatHelpers as any).handleInputChange || (() => {});
  const handleSubmit = (chatHelpers as any).handleSubmit || (() => {});
  const setMessages = (chatHelpers as any).setMessages || (() => {});
  const isLoading: boolean = (chatHelpers as any).isLoading || false;

  // APIから動的にデータを取得するuseEffect
  useEffect(() => {
    const fetchWorksheets = async () => {
      setIsLoadingData(true);
      try {
        const response = await fetch('/api/worksheets');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'ワークシートの読み込みに失敗しました。');
        }
        const data: Lesson[] = await response.json();

        // データをクライアント側で並び替え
        data.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        data.forEach(lesson => {
          lesson.topics.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
          lesson.topics.forEach(topic => {
            topic.problems.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
          });
        });

        setLessons(data);
        // 取得したデータに基づいて初期選択を設定
        if (data.length > 0 && data[0].topics.length > 0 && data[0].topics[0].problems.length > 0) {
          setSelectedLessonId(data[0].id);
          setSelectedTopicId(data[0].topics[0].id);
          setSelectedProblemId(data[0].topics[0].problems[0].id);
        }
      } catch (err: any) {
        setError(err.message);
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchWorksheets();
  }, []);

  const currentLesson = lessons.find(l => l.id === selectedLessonId);
  const currentTopic = currentLesson?.topics.find(t => t.id === selectedTopicId);
  const currentProblem = currentTopic?.problems.find(p => p.id === selectedProblemId);

  // 選択された問題が変わった時に、初期メッセージを設定する
  useEffect(() => {
    if (currentProblem && setMessages) {
      const initialMessage: Message = {
        id: 'initial-question',
        role: 'assistant',
        content: currentProblem.question,
      };
      setMessages([initialMessage]);
    }
  }, [currentProblem, setMessages]);

  const handleProblemSelect = (lessonId: string, topicId: string, problemId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedTopicId(topicId);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false);
  };

  // フォーム送信時にteacherPromptをbodyに含める
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!currentProblem || !handleSubmit) return;
    
    // 元のhandleSubmitをカスタムbodyで呼び出し
    e.preventDefault();
    
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, { id: Date.now().toString(), role: 'user', content: input }],
        teacherPrompt: currentProblem.prompt,
      }),
    })
    .then(response => response.json())
    .then(data => {
      // レスポンスを処理してメッセージを更新
      if (data.content) {
        const newMessages = [
          ...messages,
          { id: Date.now().toString(), role: 'user', content: input },
          { id: (Date.now() + 1).toString(), role: 'assistant', content: data.content }
        ];
        setMessages(newMessages);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });

    // inputをクリア（可能であれば）
    if ((chatHelpers as any).setInput) {
      (chatHelpers as any).setInput('');
    }
  };
  
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      <header className="bg-white p-4 border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-bold text-gray-800 text-center mb-2">学習支援チャット</h1>
            <div className="text-center">
                <button 
                    onClick={() => setIsSelectorOpen(!isSelectorOpen)} 
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoadingData}
                >
                    {isLoadingData ? "読み込み中..." : (currentProblem ? `${currentLesson?.name} > ${currentTopic?.name} > ${currentProblem.title}` : "問題を選択")}
                    <ChevronDownIcon />
                </button>
            </div>
        </div>
      </header>

      {isSelectorOpen && (
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-30" onClick={() => setIsSelectorOpen(false)}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-11/12 max-w-md p-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-4 text-black">問題を選択してください</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {lessons.map(lesson => (
                        <div key={lesson.id}>
                            <h3 className="font-bold text-black bg-gray-100 p-2 rounded">{lesson.name}</h3>
                            <div className="pl-2">
                            {lesson.topics.map(topic => (
                                <div key={topic.id} className="mt-1">
                                    <h4 className="font-semibold text-gray-800 p-1">{topic.name}</h4>
                                    <div className="pl-2 border-l-2 border-gray-200">
                                    {topic.problems.map(problem => (
                                        <button 
                                            key={problem.id}
                                            onClick={() => handleProblemSelect(lesson.id, topic.id, problem.id)}
                                            className={`w-full text-left p-2 rounded hover:bg-gray-100 ${problem.id === selectedProblemId ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-900'}`}
                                        >
                                            {problem.title}
                                        </button>
                                    ))}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="space-y-6 max-w-4xl mx-auto">
          {error && <div className="text-red-500 bg-red-100 p-3 rounded-lg">{error}</div>}
          {messages.map((m: Message) => (
            <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <BotIcon />}
              <div className={`max-w-lg lg:max-w-xl p-3 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-white text-black border border-gray-200 rounded-bl-none'
              }`}>
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
              </div>
              {m.role === 'user' && <UserIcon />}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3"><BotIcon /><div className="p-3 rounded-2xl bg-white border border-gray-200"><div className="flex items-center space-x-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div></div></div></div>
          )}
        </div>
      </main>

      <footer className="bg-white p-4 border-t border-gray-200 sticky bottom-0 z-10">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
            value={input}
            onChange={handleInputChange}
            placeholder="質問を入力してください..."
            disabled={isLoading || !currentProblem}
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400" disabled={isLoading || !input.trim() || !currentProblem}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </form>
      </footer>
    </div>
  );
}