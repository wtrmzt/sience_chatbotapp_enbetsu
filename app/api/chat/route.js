import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Vercel Edge Runtime を使用して、応答を高速化します
export const runtime = 'edge';

// レート制限のためのメモリマップ
const rateLimitMap = new Map();

// レート制限チェック関数
function checkRateLimit(clientId, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, []);
  }
  
  const requests = rateLimitMap.get(clientId);
  
  // 古いリクエストを削除
  const validRequests = requests.filter(time => time > windowStart);
  rateLimitMap.set(clientId, validRequests);
  
  if (validRequests.length >= limit) {
    return false;
  }
  
  // 新しいリクエストを記録
  validRequests.push(now);
  return true;
}

// メモリクリーンアップ（5分ごと）
setInterval(() => {
  const now = Date.now();
  for (const [clientId, requests] of rateLimitMap.entries()) {
    const validRequests = requests.filter(time => time > now - 300000);
    if (validRequests.length === 0) {
      rateLimitMap.delete(clientId);
    } else {
      rateLimitMap.set(clientId, validRequests);
    }
  }
}, 300000);

export async function POST(req) {
  try {
    // ▼▼▼ 修正点: OpenAIクライアントの初期化をリクエストハンドラ内に移動 ▼▼▼
    const openai = createOpenAI({
      // 環境変数はこのスコープ内で確実に参照されます
      apiKey: process.env.OPENAI_API_KEY, 
      timeout: 30000,
      maxRetries: 2,
    });
    // ▲▲▲ 修正ここまで ▲▲▲

    // リクエスト元のIPアドレスを取得
    const clientId = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'anonymous';

    // レート制限チェック（1分間に10リクエスト）
    if (!checkRateLimit(clientId, 10, 60000)) {
      return new Response(
        JSON.stringify({ 
          error: 'レート制限に達しました。しばらくお待ちください。' 
        }), 
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    // リクエストボディの検証
    const body = await req.json();
    const { messages, teacherPrompt } = body;

    // 入力検証
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'メッセージが必要です。' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const limitedMessages = messages.slice(-10);
    const sanitizedMessages = limitedMessages.map(msg => ({
      ...msg,
      content: typeof msg.content === 'string' 
        ? msg.content.slice(0, 4000) 
        : msg.content
    }));
    const sanitizedPrompt = typeof teacherPrompt === 'string' 
      ? teacherPrompt.slice(0, 2000) 
      : 'You are a helpful teaching assistant.';

    // OpenAI APIにリクエストを送信します
    const result = await streamText({
      model: openai('gpt-4o-mini'), 
      system: sanitizedPrompt,
      messages: sanitizedMessages,
      maxTokens: 1000,
      temperature: 0.7,
    });
    
    // result.streamが存在しない場合、APIエラーと判断します。
    if (!result || !result.stream) {
      console.error('API Error: "stream" property is missing from the result object.', result);
      const errorDetails = result.error || result || 'Unknown API error';
      return new Response(
        JSON.stringify({ 
          error: `OpenAI APIから無効な応答がありました。詳細: ${JSON.stringify(errorDetails)}` 
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // ストリームが正常に取得できた場合、クライアントに返します。
    return new Response(result.stream);

  } catch (error) {
    console.error('API Error caught in the main catch block:', error);

    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || '不明なサーバーエラーが発生しました。';

    return new Response(
      JSON.stringify({
        error: `サーバーエラーが発生しました。詳細は次の通りです: ${errorName} - ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

