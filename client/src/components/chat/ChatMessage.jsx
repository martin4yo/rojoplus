import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ThumbsUp, ThumbsDown, Trash2, AlertCircle } from 'lucide-react'
import chatService from '../../services/chatService'

/**
 * ChatMessage Component
 * Muestra un mensaje del chat (usuario o asistente).
 *
 * Props:
 *  - message: { ...campos }
 *  - isUser: boolean
 *  - role: 'admin' | 'camarero' | 'socio' (controla disponibilidad del invalidar cache)
 */
export default function ChatMessage({ message, isUser, role }) {
  const [feedback, setFeedback] = useState(null) // null | 'up' | 'down' | 'invalidated'

  const handleFeedback = async (positive) => {
    if (feedback || !message.hashInput) return
    setFeedback(positive ? 'up' : 'down')
    await chatService.sendFeedback(message.hashInput, positive)
  }

  const handleInvalidate = async () => {
    if (feedback || !message.hashInput) return
    if (!window.confirm('Borrar esta respuesta de la caché. La próxima vez que pregunten lo mismo, se procesará desde cero. ¿Confirmás?')) return
    setFeedback('invalidated')
    await chatService.sendFeedback(message.hashInput, false, { invalidate: true })
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            {message.isError ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                R
              </div>
            )}
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {message.isError ? 'Error' : 'Axio'}
            </span>
          </div>
        )}

        {/* Contenido del mensaje */}
        <div className={`text-sm ${isUser ? 'text-white' : ''}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  // Personalizar estilos de markdown
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2">{children}</ol>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-dark underline"
                    >
                      {children}
                    </a>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp + feedback */}
        <div className={`flex items-center justify-between mt-1 gap-2`}>
          <div
            className={`text-xs ${
              isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>

          {/* Feedback — solo para respuestas del ML service */}
          {!isUser && message.hashInput && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFeedback(true)}
                disabled={!!feedback}
                className={`p-1 rounded transition-colors ${
                  feedback === 'up'
                    ? 'text-green-500'
                    : 'text-gray-400 hover:text-green-500 disabled:opacity-40'
                }`}
                title="Buena respuesta"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleFeedback(false)}
                disabled={!!feedback}
                className={`p-1 rounded transition-colors ${
                  feedback === 'down'
                    ? 'text-red-500'
                    : 'text-gray-400 hover:text-red-500 disabled:opacity-40'
                }`}
                title="Mala respuesta"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
              {role === 'admin' && (
                <button
                  onClick={handleInvalidate}
                  disabled={!!feedback}
                  className={`p-1 rounded transition-colors ${
                    feedback === 'invalidated'
                      ? 'text-orange-500'
                      : 'text-gray-400 hover:text-orange-500 disabled:opacity-40'
                  }`}
                  title="Borrar de caché (admin)"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
