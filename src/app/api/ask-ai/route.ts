import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { AI_TOOLS } from '@/lib/aiTools'
import type { WireMessage } from '@/lib/types'

interface RequestBody {
  messages: WireMessage[]
  context: string
}

const REPLY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: "The answer to the user's question, formatted in markdown." },
    followups: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to three short, specific follow-up questions relevant to this answer. Empty array if none fit.',
    },
  },
  required: ['reply', 'followups'],
  additionalProperties: false,
} as const

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as RequestBody
    const { messages, context } = body

    if (!Array.isArray(messages) || typeof context !== 'string') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: context },
        ...messages,
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: AI_TOOLS as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
      max_tokens: 1024,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'ask_ai_reply', strict: true, schema: REPLY_JSON_SCHEMA },
      },
    })

    const message = completion.choices[0]?.message
    if (!message) {
      return NextResponse.json({ error: 'No response from model' }, { status: 502 })
    }

    const wireMessage: WireMessage = {
      role: 'assistant',
      content: message.content,
      tool_calls: message.tool_calls
        ?.filter(tc => tc.type === 'function')
        .map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
    }

    return NextResponse.json({ message: wireMessage })
  } catch (err) {
    console.error('[ask-ai] OpenAI error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
