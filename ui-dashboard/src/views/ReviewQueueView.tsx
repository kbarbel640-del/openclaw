import { useState } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { Badge, Button } from '../components/ui';
import type { ReviewQueueItem, ReviewStatus } from '../types';
import styles from './ReviewQueueView.module.css';

const TABS: { id: ReviewStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'merged', label: 'Merged' },
];

function ReviewList({
  reviews,
  selectedId,
  onSelect,
}: {
  reviews: ReviewQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (reviews.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>👁</div>
        <div className={styles.emptyText}>No reviews in this category</div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {reviews.map((review) => (
        <div
          key={review.id}
          className={`${styles.reviewItem} ${selectedId === review.id ? styles.active : ''}`}
          onClick={() => onSelect(review.id)}
        >
          <div className={styles.reviewHeader}>
            <span className={styles.reviewTitle}>{review.title}</span>
            <Badge
              variant={
                review.status === 'pending'
                  ? 'warning'
                  : review.status === 'approved'
                  ? 'success'
                  : review.status === 'rejected'
                  ? 'error'
                  : 'purple'
              }
              size="sm"
            >
              {review.status}
            </Badge>
          </div>
          <div className={styles.reviewTrack}>Track: {review.trackId.slice(0, 8)}</div>
          <div className={styles.reviewDescription}>{review.description}</div>
          <div className={styles.reviewMeta}>
            <span>{new Date(review.createdAt).toLocaleDateString()}</span>
            <div className={styles.reviewStats}>
              <span className={`${styles.stat} ${styles.additions}`}>
                +{review.diffStats.additions}
              </span>
              <span className={`${styles.stat} ${styles.deletions}`}>
                -{review.diffStats.deletions}
              </span>
              <span>{review.diffStats.filesChanged} files</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewDetail({ review }: { review: ReviewQueueItem }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.detailTitle}>{review.title}</div>
        {review.status === 'pending' && (
          <div className={styles.detailActions}>
            <Button variant="destructive" size="sm">
              Reject
            </Button>
            <Button size="sm">
              Approve
            </Button>
          </div>
        )}
      </div>

      <div className={styles.detailContent}>
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>Summary</div>
          <div className={styles.summaryText}>{review.description}</div>
        </div>

        {review.comments.length > 0 && (
          <div className={styles.comments}>
            <div className={styles.commentsTitle}>Comments</div>
            {review.comments.map((comment) => (
              <div key={comment.id} className={styles.comment}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{comment.author}</span>
                  <span className={styles.commentTime}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className={styles.commentContent}>{comment.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewQueueView() {
  const reviews = useDashboardStore((s) => s.reviews);
  const selectedReviewId = useDashboardStore((s) => s.selectedReviewId);
  const selectReview = useDashboardStore((s) => s.selectReview);
  const [activeTab, setActiveTab] = useState<ReviewStatus | 'all'>('pending');

  const filteredReviews =
    activeTab === 'all' ? reviews : reviews.filter((r) => r.status === activeTab);

  const selectedReview = reviews.find((r) => r.id === selectedReviewId);

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleWithBadge}>
          <h2 className={styles.title}>Review Queue</h2>
          {pendingCount > 0 && (
            <Badge variant="purple" size="sm">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        <ReviewList
          reviews={filteredReviews}
          selectedId={selectedReviewId}
          onSelect={selectReview}
        />
        {selectedReview ? (
          <ReviewDetail review={selectedReview} />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>👁</div>
            <div className={styles.emptyText}>Select a review to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
