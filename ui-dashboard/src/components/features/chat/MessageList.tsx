import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, Badge } from '../../ui';
import type { Message, TaskDefinition, Worker } from '../../../types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TaskCard({ task }: { task: TaskDefinition }) {
  return (
    <div className={styles.taskCard}>
      <div className={styles.taskHeader}>
        <span>📋</span>
        <span className={styles.taskTitle}>{task.title}</span>
        <Badge
          variant={
            task.status === 'running'
              ? 'success'
              : task.status === 'pending'
              ? 'warning'
              : 'muted'
          }
          size="sm"
        >
          {task.status}
        </Badge>
      </div>
      {task.description && (
        <div className={styles.taskDescription}>{task.description}</div>
      )}
      <div className={styles.taskMeta}>
        <span>⚙ {task.workerType}</span>
        {task.queuePosition !== undefined && (
          <span>Queue #{task.queuePosition}</span>
        )}
      </div>
    </div>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <div className={styles.workerCard}>
      <Avatar className="size-6">
        <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className={styles.workerInfo}>
        <div className={styles.workerName}>{worker.name}</div>
        <div className={styles.workerStatus}>
          {worker.status === 'active'
            ? `Working on: ${worker.taskDescription || 'Task'}`
            : worker.status}
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {

  const renderContent = () => {
    // Simple markdown-like rendering
    const lines = message.content.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <p key={i} style={{ fontSize: '14px', fontWeight: 600, marginTop: '12px' }}>
            {line.slice(4)}
          </p>
        );
      }
      // Bullet points
      if (line.startsWith('- ')) {
        return (
          <p key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '4px' }}>•</span>
            {line.slice(2)}
          </p>
        );
      }
      // Numbered lists
      if (/^\d+\. /.test(line)) {
        return (
          <p key={i} style={{ paddingLeft: '16px' }}>
            {line}
          </p>
        );
      }
      // Code blocks
      if (line.startsWith('```')) {
        return null; // Handle code blocks separately
      }
      // Empty lines
      if (!line.trim()) {
        return <br key={i} />;
      }
      return <p key={i}>{line}</p>;
    });
  };

  const task = message.metadata?.task as TaskDefinition | undefined;
  const worker = message.metadata?.worker as Worker | undefined;

  return (
    <div className={styles.message}>
      <div className={styles.header}>
        <Avatar className="size-6">
            <AvatarFallback>{message.senderName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        <span className={`${styles.sender} ${styles[message.sender]}`}>
          {message.senderName}
        </span>
        <span className={styles.time}>{formatTime(message.timestamp)}</span>
      </div>
      <div className={styles.content}>{renderContent()}</div>

      {/* Embedded cards based on metadata */}
      {task && <TaskCard task={task} />}
      {worker && <WorkerCard worker={worker} />}
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💬</div>
          <div className={styles.emptyText}>No messages yet</div>
          <div className={styles.emptyHint}>
            Start a conversation with the Lead Agent
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.container}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
