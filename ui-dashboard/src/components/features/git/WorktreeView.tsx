import { useState } from 'react';
import { Button } from '../../ui';
import type { WorktreeInfo, DiffResult } from '../../../types';
import styles from './WorktreeView.module.css';

// Mock data for now
const mockWorktrees: WorktreeInfo[] = [
  {
    id: 'wt1',
    taskId: 'task1',
    path: '/workspace/project/.worktrees/feature-auth',
    branch: 'feature/auth-system',
    baseBranch: 'main',
    createdAt: Date.now() - 3600000,
    lastUsedAt: Date.now() - 60000,
  },
  {
    id: 'wt2',
    taskId: 'task2',
    path: '/workspace/project/.worktrees/fix-login',
    branch: 'fix/login-validation',
    baseBranch: 'main',
    createdAt: Date.now() - 7200000,
    lastUsedAt: Date.now() - 300000,
  },
];

const mockDiff: DiffResult = {
  files: [
    {
      path: 'src/auth/login.ts',
      status: 'modified',
      additions: 45,
      deletions: 12,
      diff: `@@ -1,10 +1,15 @@
 import { validateToken } from './token';
+import { logger } from '../utils/logger';
 
 export async function login(credentials: Credentials) {
+  logger.info('Login attempt', { username: credentials.username });
+
   const user = await validateCredentials(credentials);
   if (!user) {
+    logger.warn('Login failed', { username: credentials.username });
     throw new Error('Invalid credentials');
   }
 
   const token = await generateToken(user);
+  logger.info('Login successful', { userId: user.id });
   return { user, token };
 }`,
    },
  ],
  stats: { filesChanged: 1, additions: 45, deletions: 12 },
};

function DiffView({ diff }: { diff: DiffResult }) {
  const renderDiffLine = (line: string, index: number) => {
    let type = 'context';
    if (line.startsWith('+')) type = 'addition';
    else if (line.startsWith('-')) type = 'deletion';
    else if (line.startsWith('@@')) type = 'hunk';

    if (type === 'hunk') {
      return (
        <div key={index} className={styles.diffHunkHeader}>
          {line}
        </div>
      );
    }

    return (
      <div key={index} className={`${styles.diffLine} ${styles[type]}`}>
        <span className={styles.diffLineNumber}>{index + 1}</span>
        <span className={styles.diffLineContent}>{line}</span>
      </div>
    );
  };

  return (
    <div className={styles.diffContent}>
      {diff.files.map((file) => (
        <div key={file.path} className={styles.diffFile}>
          <div className={styles.diffFileHeader}>
            {file.status === 'added' && '+ '}
            {file.status === 'deleted' && '- '}
            {file.path}
            <span style={{ marginLeft: 'auto' }}>
              <span className={styles.statAdditions}>+{file.additions}</span>{' '}
              <span className={styles.statDeletions}>-{file.deletions}</span>
            </span>
          </div>
          <div className={styles.diffHunk}>
            {file.diff.split('\n').map((line, i) => renderDiffLine(line, i))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorktreeView() {
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const worktrees = mockWorktrees; // TODO: Use from store

  const selectedWorktree = worktrees.find((w) => w.id === selectedWorktreeId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Git Worktrees</h2>
        <div className={styles.toolbar}>
          <Button variant="secondary" size="sm">
            Cleanup All
          </Button>
          <Button variant="default" size="sm">
            + New Worktree
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Active Worktrees</div>
            <div className={styles.worktreeList}>
              {worktrees.map((worktree) => (
                <div
                  key={worktree.id}
                  className={`${styles.worktreeCard} ${
                    selectedWorktreeId === worktree.id ? styles.active : ''
                  }`}
                  onClick={() => setSelectedWorktreeId(worktree.id)}
                >
                  <div className={styles.worktreeHeader}>
                    <span>⎇</span>
                    <span className={styles.worktreeBranch}>{worktree.branch}</span>
                  </div>
                  <div className={styles.worktreePath}>{worktree.path}</div>
                  <div className={styles.worktreeMeta}>
                    <span>Base: {worktree.baseBranch}</span>
                    <span>Updated {new Date(worktree.lastUsedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Base Branches</div>
            <div className={styles.branchList}>
              <div className={`${styles.branchItem} ${styles.active}`}>
                <span className={styles.branchIcon}>●</span>
                <span className={styles.branchName}>main</span>
                <span className={styles.branchMeta}>2 ahead</span>
              </div>
              <div className={styles.branchItem}>
                <span className={styles.branchIcon}>○</span>
                <span className={styles.branchName}>develop</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.main}>
          {selectedWorktree ? (
            <>
              <div className={styles.diffHeader}>
                <div className={styles.diffTitle}>
                  Diff: {selectedWorktree.branch} vs {selectedWorktree.baseBranch}
                </div>
                <div className={styles.diffStats}>
                  <span>{mockDiff.stats.filesChanged} files</span>
                  <span className={styles.statAdditions}>+{mockDiff.stats.additions}</span>
                  <span className={styles.statDeletions}>-{mockDiff.stats.deletions}</span>
                </div>
              </div>
              <DiffView diff={mockDiff} />
            </>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⎇</div>
              <div>Select a worktree to view changes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
