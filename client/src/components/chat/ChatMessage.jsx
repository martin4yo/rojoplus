import React from 'react'
import ReactMarkdown from 'react-markdown'

/**
 * ChatMessage Component
 * Muestra un mensaje del chat (usuario o asistente)
 */
export default function ChatMessage({ message, isUser }) {
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
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              R
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Xavi
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

        {/* Timestamp */}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  )
}
