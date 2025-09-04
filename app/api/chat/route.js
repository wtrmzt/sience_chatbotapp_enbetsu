import { streamText } from 'ai'; // StreamingTextResponse のインポートを削除
import { createOpenAI } from '@ai-sdk/openai'; // 'OpenAI'ではなく'createOpenAI'をインポート

// 起動時にAPIキーの存在をチェック
if (!process.env.OPENAI_API_KEY) {
  console.error(
    '【エラー】 環境変数にOPENAI_API_KEYが設定されていません。Renderのダッシュボードで設定してください。'
  );
}

const openai = createOpenAI({ // newを使わずに呼び出す
  // コネクション設定の最適化
  timeout: 30000, // 30秒タイムアウト
  maxRetries: 2,  // リトライ回数を制限
});

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
    // リクエスト処理時にAPIキーをチェック
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'サーバー側でAPIキーが設定されていません。管理者にお問い合わせください。' 
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

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
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: '無効なリクエスト形式です。' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, teacherPrompt } = body;

    // 入力検証
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'メッセージが必要です。' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // メッセージ履歴を最新の10件に制限（メモリ使用量削減）
    const limitedMessages = messages.slice(-10);

    // 各メッセージの長さを制限（4000文字以下）
    const sanitizedMessages = limitedMessages.map(msg => ({
      ...msg,
      content: typeof msg.content === 'string' 
        ? msg.content.slice(0, 4000) 
        : msg.content
    }));

    // システムプロンプトの長さも制限
    const sanitizedPrompt = typeof teacherPrompt === 'string' 
      ? teacherPrompt.slice(0, 2000) 
      : 'You are a helpful teaching assistant.';

    // OpenAI APIにリクエストを送信します
    const result = await streamText({
      model: openai('gpt-4o-mini'), // より軽量なモデルを使用
      system: sanitizedPrompt,
      messages: sanitizedMessages,
      maxTokens: 1000, // レスポンストークンを制限
      temperature: 0.7,
    });
    
    // ▼▼▼ 修正点: デバッグ用にレスポンスをログ出力する ▼▼▼
    
    // ストリームは一度しか読み取れないため、tee()メソッドで2つに分岐させます。
    // 一方をログ出力用、もう一方をクライアントへのレスポンス用に使います。
    const [logStream, clientStream] = result.stream.tee();

    // ログ出力用の非同期関数を定義
    const logResponse = async () => {
      const reader = logStream.getReader();
      const decoder = new TextDecoder();
      console.log('--- OpenAIからのレスポンス開始 ---');
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('--- OpenAIからのレスポンス終了 ---');
          break;
        }
        // valueはUint8Array形式なので、人間が読める文字列に変換してログに出力します。
        const chunk = decoder.decode(value, { stream: true });
        // データチャンクの形式（`data: {...}`）でログに出力されます。
        process.stdout.write(chunk);
      }
    };
    
    // ログ出力をバックグラウンドで実行します（クライアントへの応答をブロックしません）。
    logResponse();

    // クライアントには、分岐させたもう片方のストリームを返します。
    return new Response(clientStream);
    // ▲▲▲ 修正ここまで ▲▲▲

  } catch (error) {
    console.error('API Error:', error);

    // エラーの種類に応じて適切なレスポンスを返す
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'リクエストがタイムアウトしました。' }), 
        { status: 408, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (error.status === 429) {
      return new Response(
        JSON.stringify({ error: 'APIの利用制限に達しました。しばらくお待ちください。' }), 
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (error.status === 401) {
      return new Response(
        JSON.stringify({ error: 'API認証エラーです。APIキーが正しいか確認してください。' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 予期せぬエラーが発生した場合、エラーの詳細をクライアントに返し、デバッグしやすくします。
    const errorMessage = error.message || '不明なサーバーエラーが発生しました。';
    const errorName = error.name || 'UnknownError';

    return new Response(
      JSON.stringify({
        error: `サーバーエラーが発生しました。詳細は次の通りです: ${errorName} - ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

