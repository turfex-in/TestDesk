import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { addComment, watchComments, uploadScreenshot } from '../../services/firebaseService'
import { useAuth } from '../../context/AuthContext.jsx'
import Avatar from '../common/Avatar.jsx'
import { fmtDate, fmtRelative } from '../../utils/helpers'
import Badge from '../common/Badge.jsx'
import toast from 'react-hot-toast'
import { cn } from '../../utils/helpers'

export default function BugDiscussion({ bug }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState([])
  const [message, setMessage] = useState('')
  const [attachFile, setAttachFile] = useState(null)
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (!bug?.id) return
    const off = watchComments(bug.id, (list) => {
      setComments(list)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    })
    return () => off && off()
  }, [bug?.id])

  async function onSend(e) {
    e?.preventDefault()
    if (!message.trim() && !attachFile) return
    setSending(true)
    try {
      const attachments = []
      if (attachFile) {
        const path = `comments/${bug.projectId}/${Date.now()}-${attachFile.name}`
        const url = await uploadScreenshot(path, attachFile)
        attachments.push(url)
      }
      await addComment(bug.id, {
        userId: profile.uid,
        userName: profile.name,
        userRole: profile.role,
        message: message.trim(),
        attachments,
        projectId: bug.projectId || null,
      })
      setMessage('')
      setAttachFile(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center gap-2">
        <MessageSquare size={16} className="text-primary" />
        <h3 className="text-h3 m-0">Activity & Discussion</h3>
        <span className="ml-auto text-body-md text-ink-dim">{comments.length} messages</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-5 py-4 space-y-5">
        {comments.length === 0 && (
          <div className="text-center text-ink-dim text-body-md py-8">
            No messages yet. Start the discussion.
          </div>
        )}
        {comments.map((c) => (
          <CommentBubble key={c.id} comment={c} isMine={c.userId === profile.uid} />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSend} className="border-t border-outline-variant/40 p-4">
        {attachFile && (
          <div className="flex items-center gap-2 mb-2 text-body-md">
            <Badge tone="primary">{attachFile.name}</Badge>
            <button type="button" onClick={() => setAttachFile(null)} className="text-ink-dim hover:text-ink">
              ×
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message… (markdown + inline `code` supported)"
            className="input min-h-[40px] flex-1 resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSend(e)
              }
            }}
          />
          <label className="btn btn-sm btn-ghost w-10 p-0 cursor-pointer">
            <Paperclip size={16} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setAttachFile(e.target.files[0])}
            />
          </label>
          <button type="submit" disabled={sending} className="btn btn-md btn-primary">
            <Send size={14} /> Send
          </button>
        </div>
      </form>
    </div>
  )
}

function CommentBubble({ comment, isMine }) {
  return (
    <div className={cn('flex gap-3', isMine && 'flex-row-reverse')}>
      <Avatar name={comment.userName} size="sm" />
      <div className={cn('flex-1 min-w-0 max-w-[80%]', isMine && 'text-right')}>
        <div className={cn('flex items-center gap-2 mb-1 text-body-md', isMine && 'justify-end')}>
          <span className="font-semibold">{comment.userName}</span>
          <Badge tone={comment.userRole === 'developer' ? 'primary' : 'tertiary'} size="sm">
            {comment.userRole}
          </Badge>
          <span className="text-[11px] text-ink-dim">{fmtRelative(comment.createdAt)}</span>
        </div>
        <div
          className={cn(
            'inline-block text-left rounded-md px-4 py-3 border',
            isMine
              ? 'bg-primary-container/10 border-primary/20'
              : 'bg-surface-high/70 border-outline-variant/40'
          )}
        >
          {comment.message && (
            <div className="prose prose-invert prose-sm max-w-none text-body-md">
              <ReactMarkdown
                components={{
                  code: ({ children }) => (
                    <code className="font-mono text-[12px] bg-surface-highest text-primary px-1.5 py-0.5 rounded-sm">
                      {children}
                    </code>
                  ),
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                }}
              >
                {comment.message}
              </ReactMarkdown>
            </div>
          )}
          {(comment.attachments || []).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="mt-2 max-w-[200px] rounded border border-outline-variant/40"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
