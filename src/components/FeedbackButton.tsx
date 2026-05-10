'use client';

import { trackEvent } from '@/lib/analytics';
import styles from './FeedbackButton.module.css';

const FEEDBACK_URL = 'https://forms.gle/ghLEGyZ8dPkTx1GB6';

export default function FeedbackButton() {
    return (
        <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.feedbackButton}
            aria-label="Share feedback"
            data-tooltip="Share feedback"
            onClick={() => trackEvent('feedback_button_click', { destination: 'google_form' })}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        </a>
    );
}
