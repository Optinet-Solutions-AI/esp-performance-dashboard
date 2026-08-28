'use client'
import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { buildAIContext } from '@/lib/aiContext'
import { executeAiTool } from '@/lib/aiTools'
import type { AIContextInput, ChatMessage, UseAskAIReturn, WireMessage } from '@/lib/types'

const MAX_TOOL_ROUNDS = 5

export function useAskAI(): UseAskAIReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const store = useDashboardStore()

  const sendMessage = async (text: string): Promise<void> => {
    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setIsLoading(true)
    setError(null)

    try {
      const toolCtx: AIContextInput = {
        esps: store.esps,
        espData: store.espData,
        ipmData: store.ipmData,
        throttleData: store.throttleData,
      }
      const context = buildAIContext(toolCtx)

      const wire: WireMessage[] = nextMessages.map(m => ({ role: m.role, content: m.content }))

      let finalReply = ''
      let finalFollowups: string[] = []

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const res = await fetch('/api/ask-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: wire, context }),
        })

        const data = await res.json() as { message?: WireMessage; error?: string }

        if (!res.ok || data.error || !data.message) {
          throw new Error(data.error ?? 'Request failed')
        }

        const assistantMessage = data.message
        wire.push(assistantMessage)

        if (assistantMessage.tool_calls?.length) {
          for (const call of assistantMessage.tool_calls) {
            let args: Record<string, unknown> = {}
            try { args = JSON.parse(call.function.arguments || '{}') } catch { /* leave empty */ }
            const result = executeAiTool(call.function.name, args, toolCtx)
            wire.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
          }
          continue
        }

        try {
          const parsed = JSON.parse(assistantMessage.content ?? '{}') as { reply?: string; followups?: string[] }
          finalReply = parsed.reply ?? ''
          finalFollowups = parsed.followups ?? []
        } catch {
          finalReply = assistantMessage.content ?? ''
        }
        break
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: finalReply, followups: finalFollowups }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const clearMessages = (): void => {
    setMessages([])
    setError(null)
  }

  return { messages, isLoading, error, sendMessage, clearMessages }
}
