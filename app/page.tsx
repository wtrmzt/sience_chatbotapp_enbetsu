'use client';

import { useState, useEffect,useRef } from 'react';
import { Lesson, Topic, Problem } from '../types';

// Message type definition - simplified to match basic structure
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// --- Icon Components ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3.5 3.5h-1v-5h1v5z"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// ★追加: 1文字ずつ表示するためのコンポーネント
const StreamingMessage = ({ content }: { content: string }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const currentIndexRef = useRef(0);

  useEffect(() => {
    // 新しいコンテンツがストリームで追加された場合、タイピングを続行
    if (currentIndexRef.current < content.length) {
      const intervalId = setInterval(() => {
        if (currentIndexRef.current < content.length) {
          // 表示するテキストを1文字ずつ増やしていく
          setDisplayedContent(content.substring(0, currentIndexRef.current + 1));
          currentIndexRef.current += 1;
        } else {
          clearInterval(intervalId);
        }
      }, 30); // 1文字を表示する速度 (ミリ秒)

      // コンポーネントがアンマウントされたらインターバルをクリア
      return () => clearInterval(intervalId);
    }
  }, [content]);

  return <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{displayedContent}</p>;
};

export default function ChatbotPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Manual chat state management instead of useChat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // ★追加: チャットの自動スクロール用のref
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchWorksheets = async () => {
      setIsLoadingData(true);
      try {
        // タイムスタンプを追加してキャッシュを確実に無効化します
        const response = await fetch(`/api/worksheets?_=${new Date().getTime()}`, { cache: 'no-store' }); 
        
        if (!response.ok) throw new Error('ワークシートの読み込みに失敗しました。');
        
        const data: Lesson[] = await response.json();

        // データが空でないかチェック
        if (!data || data.length === 0) {
          setLessons([]);
          setError("利用可能な学習課題がありません。");
          return;
        }

        // データの並び替え
        data.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        data.forEach(lesson => {
          lesson.topics.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
          lesson.topics.forEach(topic => {
            topic.problems.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
          });
        });

        setLessons(data);
        // 最初の有効な問題を選択する
        const firstLesson = data[0];
        const firstTopic = firstLesson?.topics[0];
        const firstProblem = firstTopic?.problems[0];
        
        if (firstLesson && firstTopic && firstProblem) {
          setSelectedLessonId(firstLesson.id);
          setSelectedTopicId(firstTopic.id);
          setSelectedProblemId(firstProblem.id);
        } else {
           setError("利用可能な学習課題が見つかりません。");
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchWorksheets();
  }, []);

  // ★追加: メッセージが更新されるたびに一番下までスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentLesson = lessons.find(l => l.id === selectedLessonId);
  const currentTopic = currentLesson?.topics.find(t => t.id === selectedTopicId);
  const currentProblem = currentTopic?.problems.find(p => p.id === selectedProblemId);

  // Set initial message when selected problem changes
  useEffect(() => {
    if (currentProblem) {
      const initialMessage: ChatMessage = {
        id: 'initial-question',
        role: 'assistant',
        content: currentProblem.question,
      };
      setMessages([initialMessage]);
    }
  }, [currentProblem]);

  const handleProblemSelect = (lessonId: string, topicId: string, problemId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedTopicId(topicId);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false);
  };

  // ★修正: ストリーミング対応とエラーハンドリングを強化したフォーム送信処理
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!currentProblem || !input.trim() || isLoading) return;
    
    const userInput = input.trim();
    // Clear input and error message immediately
    setInput('');
    setError(null);
    setIsLoading(true);
    
    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
    };

    // Update messages with user input and placeholder for assistant's response
    const updatedMessages = [...messages, userMessage];
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    
    setMessages([...updatedMessages, assistantMessage]);
    
// handleFormSubmit関数内のAPI呼び出し部分をこれに置き換えてください

    try {
      console.log('=== Sending request to API ===');
      
      // Send request to API with teacher prompt
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          teacherPrompt: currentProblem.prompt,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response content-type:', response.headers.get('content-type'));

      // Handle non-200 responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(`APIエラー (${response.status}): ${errorData.message || errorData.error || 'サーバーエラーが発生しました。'}`);
        } catch (parseError) {
          throw new Error(`APIエラー (${response.status}): ${errorText || 'サーバーエラーが発生しました。'}`);
        }
      }

      // Check content type to determine how to process the response
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // JSONレスポンスの場合（エラーレスポンス）
        const jsonData = await response.json();
        if (jsonData.error) {
          throw new Error(jsonData.error);
        }
        // JSONに content フィールドがある場合
        const content = jsonData.content || jsonData.message || '';
        if (content) {
          setMessages(currentMessages => 
            currentMessages.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content }
                : msg
            )
          );
        } else {
          throw new Error('APIからの応答にcontentが含まれていません。');
        }
      } else if (contentType.includes('text/plain')) {
        // プレーンテキストレスポンスの場合（非ストリーミング）
        const textContent = await response.text();
        console.log('Received text content:', textContent.substring(0, 100) + '...');
        
        if (!textContent.trim()) {
          throw new Error('APIからの応答が空でした。');
        }
        
        setMessages(currentMessages => 
          currentMessages.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: textContent }
              : msg
          )
        );
      } else {
        // ストリーミングレスポンスの場合
        console.log('Processing as streaming response...');
        
        if (!response.body) {
          throw new Error('APIからのレスポンスにボディが含まれていません。');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            
            setMessages(currentMessages => 
              currentMessages.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          }
        } finally {
          reader.releaseLock();
        }
        
        if (accumulatedContent.trim() === '') {
          throw new Error('APIからの応答が空でした。');
        }
      }

    } catch (error: any) {
      console.error('=== Submit Error ===', error);
      setError(error.message || 'メッセージの送信中にエラーが発生しました。');
      
      // On error, remove the placeholder assistant message
      setMessages(updatedMessages);
      // Restore user input to allow for resubmission
      setInput(userInput);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      {/* Header */}
      <header className="bg-white p-4 border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-800 text-center mb-2">
            学習支援チャット
          </h1>
          <div className="text-center">
            <button 
              onClick={() => setIsSelectorOpen(!isSelectorOpen)} 
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoadingData}
            >
              {isLoadingData 
                ? "Loading... / 読み込み中..." 
                : (currentProblem 
                    ? `${currentLesson?.name} > ${currentTopic?.name} > ${currentProblem.title}` 
                    : "Select Problem / 問題を選択")
              }
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Problem Selector Modal */}
      {isSelectorOpen && (
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-30" onClick={() => setIsSelectorOpen(false)}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-11/12 max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-black">
              問題を選択してください
            </h2>
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
                              className={`w-full text-left p-2 rounded hover:bg-gray-100 ${
                                problem.id === selectedProblemId 
                                  ? 'bg-blue-50 text-blue-600 font-bold' 
                                  : 'text-gray-900'
                              }`}
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
          
          {/* ★修正: メッセージのレンダリングをタイピングエフェクトに対応 */}
          {messages.map((m: ChatMessage, index: number) => {
              const isLastMessage = index === messages.length - 1;
              // ローディング中で、アシスタントからの最後のメッセージの場合のみタイピングエフェクトを適用
              const isStreaming = isLoading && isLastMessage && m.role === 'assistant';

              return (
                <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && <BotIcon />}
                  <div className={`max-w-lg lg:max-w-xl p-3 rounded-2xl ${
                      m.role === 'user' 
                        ? 'bg-blue-500 text-white rounded-br-none' 
                        : 'bg-white text-black border border-gray-200 rounded-bl-none'
                    }`}>
                    {isStreaming ? (
                      <StreamingMessage content={m.content} />
                    ) : (
                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
                    )}
                  </div>
                  {m.role === 'user' && <UserIcon />}
                </div>
              );
          })}
          
          {/* ★修正: 自動スクロールのためのターゲット要素 */}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Footer */}
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
          <button 
            type="submit" 
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors" 
            disabled={isLoading || !input.trim() || !currentProblem}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}