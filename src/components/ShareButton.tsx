'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { buildShareUrl, formatCoordinates, type ViewportCoordinates } from '@/lib/deepLinkUtils';
import styles from './ShareButton.module.css';

const SHARE_TEMPLATES = [
    { id: 'fortress', text: "I'm building a fortress here. Come help me defend it! 🏰", hashtag: '#drawny' },
    { id: 'art', text: "Check out this art — it'll be gone tomorrow! 🎨", hashtag: '#drawny #ephemeralart' },
    { id: 'wild', text: 'Someone drew something wild here. Come see! 👀', hashtag: '#drawny' },
    { id: 'crew', text: "We're taking over this corner. Join the crew! ⚡", hashtag: '#drawny' },
    { id: 'custom', text: 'Custom message...', hashtag: '#drawny' },
];

interface ShareButtonProps {
    viewport?: ViewportCoordinates | null;
    onCaptureSnapshot?: () => Promise<string | null>;
}

export default function ShareButton({ viewport, onCaptureSnapshot }: ShareButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [showCopied, setShowCopied] = useState(false);
    const [showUrlCopied, setShowUrlCopied] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(SHARE_TEMPLATES[0].id);
    const [customMessage, setCustomMessage] = useState('');

    // SSR-safe: compute share URL in state, not directly in render
    const [shareUrl, setShareUrl] = useState('');
    useEffect(() => {
        setShareUrl(buildShareUrl(viewport));
    }, [viewport]);

    // Snapshot state
    const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const handleButtonClick = useCallback(async () => {
        // Re-compute URL fresh when modal opens
        setShareUrl(buildShareUrl(viewport));
        setShowModal(true);

        // Capture snapshot
        if (onCaptureSnapshot) {
            setIsCapturing(true);
            try {
                const url = await onCaptureSnapshot();
                setSnapshotUrl(url);
                console.log('[Share] Snapshot captured:', url ? 'success' : 'empty canvas');
            } catch (error) {
                console.error('[Share] Snapshot capture failed:', error);
                setSnapshotUrl(null);
            } finally {
                setIsCapturing(false);
            }
        }
    }, [viewport, onCaptureSnapshot]);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setCustomMessage('');
        // Revoke snapshot blob URL to free memory
        if (snapshotUrl) {
            URL.revokeObjectURL(snapshotUrl);
            setSnapshotUrl(null);
        }
    }, [snapshotUrl]);

    const getShareMessage = useCallback(() => {
        if (selectedTemplate === 'custom') {
            return customMessage || 'Check out this spot on Drawny!';
        }
        const template = SHARE_TEMPLATES.find(t => t.id === selectedTemplate);
        return template ? template.text : 'Check out this spot on Drawny!';
    }, [selectedTemplate, customMessage]);

    const getShareHashtag = useCallback(() => {
        const template = SHARE_TEMPLATES.find(t => t.id === selectedTemplate);
        return template?.hashtag || '#drawny';
    }, [selectedTemplate]);

    // ─── Clipboard helpers ───────────────────────────────────────────────

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setShowCopied(true);
            setShowModal(false);
            if (snapshotUrl) {
                URL.revokeObjectURL(snapshotUrl);
                setSnapshotUrl(null);
            }
            setTimeout(() => setShowCopied(false), 2000);
            console.log('[Share] Text copied to clipboard');
        } catch (error) {
            console.error('[Share] Failed to copy:', error);
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
    }, [snapshotUrl]);

    const copyUrlOnly = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShowUrlCopied(true);
            setTimeout(() => setShowUrlCopied(false), 2000);
            console.log('[Share] URL copied to clipboard');
        } catch (error) {
            console.error('[Share] Failed to copy URL:', error);
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setShowUrlCopied(true);
                setTimeout(() => setShowUrlCopied(false), 2000);
            } catch (err) {
                console.error('[Share] Fallback URL copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
    }, [shareUrl]);

    // ─── Share actions ───────────────────────────────────────────────────

    const handleShare = useCallback(async () => {
        const message = getShareMessage();
        const hashtag = getShareHashtag();
        const text = `${message}\n\n${shareUrl}\n\n${hashtag}`;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: 'Drawny - Draw with strangers',
                    text,
                });
                console.log('[Share] Successfully shared via Web Share API');
                handleCloseModal();
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('[Share] Error sharing:', error);
                    copyToClipboard(text);
                }
            }
        } else {
            copyToClipboard(text);
        }
    }, [getShareMessage, getShareHashtag, shareUrl, copyToClipboard, handleCloseModal]);

    const shareToTwitter = useCallback(() => {
        const message = getShareMessage();
        const hashtag = getShareHashtag();
        const text = encodeURIComponent(`${message}\n\n${shareUrl}\n\n${hashtag}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
        console.log('[Share] Opened Twitter share');
    }, [getShareMessage, getShareHashtag, shareUrl]);

    const shareToWhatsApp = useCallback(() => {
        const message = getShareMessage();
        const text = encodeURIComponent(`${message}\n${shareUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
        console.log('[Share] Opened WhatsApp share');
    }, [getShareMessage, shareUrl]);

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

                {/* URL copied notification */}
                {showUrlCopied && (
                    <div className={styles.copiedNotification}>
                        ✓ URL copied to clipboard!
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Share this spot</h3>
                            <button className={styles.closeButton} onClick={handleCloseModal}>
                                ×
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* Snapshot Preview */}
                            <div className={styles.snapshotCard}>
                                {isCapturing ? (
                                    <div className={styles.snapshotLoading}>
                                        <div className={styles.snapshotSpinner} />
                                        <span>Capturing view…</span>
                                    </div>
                                ) : snapshotUrl ? (
                                    <img
                                        src={snapshotUrl}
                                        alt="Current canvas view"
                                        className={styles.snapshotImage}
                                    />
                                ) : (
                                    <div className={styles.snapshotEmpty}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                        <span>Empty canvas — start drawing!</span>
                                    </div>
                                )}

                                {/* Coordinate overlay on snapshot */}
                                {viewport && (
                                    <div className={styles.coordinateOverlay}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span>{formatCoordinates(viewport)}</span>
                                    </div>
                                )}
                            </div>

                            <p className={styles.modalDescription}>
                                Pick a vibe for your share:
                            </p>

                            <div className={styles.templateList}>
                                {SHARE_TEMPLATES.map((template) => (
                                    <label
                                        key={template.id}
                                        className={`${styles.templateOption} ${selectedTemplate === template.id ? styles.selected : ''
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
                                    rows={2}
                                />
                            )}

                            <div className={styles.previewBox}>
                                <strong>Preview:</strong>
                                <p>{getShareMessage()}</p>
                                <div className={styles.urlContainer}>
                                    <code>{shareUrl}</code>
                                    <button
                                        className={styles.copyUrlButton}
                                        onClick={copyUrlOnly}
                                        aria-label="Copy URL only"
                                        title="Copy URL only"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Social share buttons */}
                            <div className={styles.socialRow}>
                                <button className={styles.socialButton} onClick={shareToTwitter} title="Share on X / Twitter">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                    <span>X / Twitter</span>
                                </button>
                                <button className={styles.socialButton} onClick={shareToWhatsApp} title="Share on WhatsApp">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    <span>WhatsApp</span>
                                </button>
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
                                Copy & Share
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
