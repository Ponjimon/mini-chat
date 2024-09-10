import { Pencil, RefreshCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Spinner } from '~/components/Spinner'
import { cn } from '~/lib/utils'

type MessageProps = {
  children: ReactNode
  role: RoleScopedChatInput['role']
  isLoading?: boolean
  onEdit?: () => void
  onRetry?: () => void
}

export const Message = ({ children, role, isLoading, onEdit, onRetry }: MessageProps) => (
  <div className={cn('mb-4 group', role !== 'user' ? 'text-left' : 'text-right')}>
    <div className="inline-flex flex-col justify-center gap-2">
      <div
        className={cn(
          'inline-block p-3 rounded-lg',
          role !== 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
        )}
      >
        {typeof children === 'string' && (
          <ReactMarkdown
            className={cn(
              'prose prose-h1:text-4xl prose-p:text-base prose-strong:text-medium prose-ul:list-disc',
              role !== 'user' ? 'text-primary-foreground' : 'text-primary',
            )}
          >
            {children}
          </ReactMarkdown>
        )}
        {typeof children !== 'string' && children}
        {isLoading && <Spinner className="inline size-4" />}
      </div>
      <div
        className={cn(
          'inline-flex gap-2',
          isLoading && 'invisible',
          role !== 'user' ? 'justify-start' : 'justify-end',
          role === 'user' && 'invisible group-hover:visible',
        )}
      >
        {role !== 'user' && (
          <button type="button" onClick={() => onRetry?.()}>
            <RefreshCcw className="size-3" />
            <span className="sr-only">Retry</span>
          </button>
        )}
        {role === 'user' && (
          <button type="button" onClick={() => onEdit?.()}>
            <Pencil className="size-3" />
            <span className="sr-only">Edit</span>
          </button>
        )}
      </div>
    </div>
  </div>
)
