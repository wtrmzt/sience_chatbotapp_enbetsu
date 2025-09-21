import OpenAI from 'openai';

// OpenAIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, teacherPrompt } = await req.json();

    // 環境変数チェック
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // システムメッセージを追加
    const systemMessage = {
      role: 'system' as const,
      content: teacherPrompt || 'あなたは親切なアシスタントです。',
    };

    const userMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // まず非ストリーミングで試してみる（デバッグ用）
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemMessage, ...userMessages],
      temperature: 0.7,
      max_tokens: 1500,
      stream: false, // まずストリーミングなしで試す
    });

    const content = completion.choices[0]?.message?.content || '';
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'OpenAI returned empty content' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // レスポンスをプレーンテキストとして返す
    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'API request failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}