// Vercel AI SDKのインポートを削除し、Web標準のAPIを使用します

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
    // APIキーの存在チェック
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set.');
      return new Response(
        JSON.stringify({ error: 'サーバー側でAPIキーが設定されていません。' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // リクエスト元のIPアドレスを取得
    const clientId = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'anonymous';

    // レート制限チェック
    if (!checkRateLimit(clientId, 10, 60000)) {
      return new Response(
        JSON.stringify({ error: 'レート制限に達しました。' }), 
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, teacherPrompt } = await req.json();

    // 入力検証
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'メッセージが必要です。' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // OpenAI APIに送信するリクエストボディを構築
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: teacherPrompt || 'You are a helpful teaching assistant.' },
        ...messages.slice(-10) // 最新の10件のメッセージを含める
      ],
      stream: true, // ストリーミングを有効にする
      max_tokens: 1000,
      temperature: 0.7,
    };

    // ▼▼▼ 修正点: 標準のfetchを使用してOpenAI APIを直接呼び出す ▼▼▼
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    // OpenAIからの応答がエラーでないかチェック
    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.json();
      console.error('OpenAI API Error:', errorBody);
      return new Response(
        JSON.stringify({ error: `OpenAI APIからのエラー: ${errorBody.error.message}` }),
        { status: openaiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // OpenAIからのストリームをそのままクライアントに中継する
    return new Response(openaiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
    // ▲▲▲ 修正ここまで ▲▲▲

  } catch (error) {
    console.error('API Error caught in the main catch block:', error);
    return new Response(
      JSON.stringify({ error: 'サーバーで予期せぬエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

