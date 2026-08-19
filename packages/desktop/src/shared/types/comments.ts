export type CommentStatus = 'open' | 'resolved'

export interface ICommentAuthor {
  name: string
  [key: string]: unknown
}

export interface ICommentReply {
  id: string
  author: ICommentAuthor
  createdAt: string
  updatedAt: string
  body: string
  [key: string]: unknown
}

export interface ICommentThread {
  id: string
  status: CommentStatus
  orphaned: boolean
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
  createdAt: string
  updatedAt: string
  author: ICommentAuthor
  body: string
  replies: ICommentReply[]
  [key: string]: unknown
}

export interface ICommentsFile {
  version: 1
  comments: ICommentThread[]
  [key: string]: unknown
}

export type CommentsSidecarErrorCode = 'UNREADABLE' | 'BAD_VERSION'

export class CommentsSidecarError extends Error {
  readonly code: CommentsSidecarErrorCode

  constructor(code: CommentsSidecarErrorCode, message: string) {
    super(message)
    this.name = 'CommentsSidecarError'
    this.code = code
  }
}

export const COMMENTS_FILE_VERSION = 1 as const
export const QUOTE_CONTEXT_CHARS = 32
