'use client';

import React, { useState, useCallback } from 'react';
import styles from './ShareButton.module.css';

const SHARE_TEMPLATES = [
    { id: 'help', text: 'Help me defend this spot!' },
    { id: 'check', text: 'Check out this cool drawing!' },
    { id: 'join', text: 'Join me drawing here!' },
    { id: 'attack', text: 'Let\'s take over this area!' },
    { id: 'custom', text: 'Custom message...' },
];

export default function ShareButton() {
    const [showModal, setShowModal] = useState(false);
    const [showCopied, setShowCopied] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(SHARE_TEMPLATES[0].id);
    const [customMessage, setCustomMessage] = useState('');

    const handleButtonClick = useCallback(() => {
        setShowModal(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setCustomMessage('');
    }, []);

    const getShareMessage = useCallback(() => {
        if (selectedTemplate === 'custom') {
            return customMessage || 'Check out this spot on Drawny!';
        }
        const template = SHARE_TEMPLATES.find(t => t.id === selectedTemplate);
        return template ? template.text : 'Check out this spot on Drawny!';
    }, [selectedTemplate, customMessage]);

    const handleShare = useCallback(async () => {
        const url = window.location.href;
        const message = getShareMessage();
        const text = `${message} ${url}`;

        // Check if we're on mobile (where Web Share API works well)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Only use Web Share API on mobile devices
        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: 'Drawny - Draw with strangers',
                    text,
                });
                console.log('[Share] Successfully shared via Web Share API');
                setShowModal(false);
            } catch (error) {
                // User cancelled or error occurred
                if ((error as Error).name !== 'AbortError') {
                    console.error('[Share] Error sharing:', error);
                    // Fallback to copy
                    copyToClipboard(text);
                }
            }
        } else {
            // Desktop: Always copy to clipboard
            copyToClipboard(text);
        }
    }, [getShareMessage]);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setShowCopied(true);
            setShowModal(false);
            setTimeout(() => setShowCopied(false), 2000);
            console.log('[Share] Text copied to clipboard');
        } catch (error) {
            console.error('[Share] Failed to copy:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setShowCopied(true);
                setShowModal(false);
                setTimeout(() => setShowCopied(false), 2000);
            } catch (err) {
                console.error('[Share] Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }, []);

    return (
        <>
            <div className={styles.container}>
                <button
                    className={styles.shareButton}
                    onClick={handleButtonClick}
                    aria-label="Share this location"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span className={styles.buttonText}>Share</span>
                </button>

                {/* Copied notification */}
                {showCopied && (
                    <div className={styles.copiedNotification}>
                        ✓ Copied to clipboard!
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Share this location</h3>
                            <button className={styles.closeButton} onClick={handleCloseModal}>
                                ×
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <p className={styles.modalDescription}>
                                Choose a message to share with your link:
                            </p>

                            <div className={styles.templateList}>
                                {SHARE_TEMPLATES.map((template) => (
                                    <label
                                        key={template.id}
                                        className={`${styles.templateOption} ${
                                            selectedTemplate === template.id ? styles.selected : ''
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="template"
                                            value={template.id}
                                            checked={selectedTemplate === template.id}
                                            onChange={(e) => setSelectedTemplate(e.target.value)}
                                        />
                                        <span>{template.text}</span>
                                    </label>
                                ))}
                            </div>

                            {selectedTemplate === 'custom' && (
                                <textarea
                                    className={styles.customInput}
                                    placeholder="Enter your custom message..."
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    maxLength={200}
                                    rows={3}
                                />
                            )}

                            <div className={styles.previewBox}>
                                <strong>Preview:</strong>
                                <p>{getShareMessage()}</p>
                                <code>{window.location.href}</code>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.cancelButton} onClick={handleCloseModal}>
                                Cancel
                            </button>
                            <button className={styles.shareButtonPrimary} onClick={handleShare}>
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

