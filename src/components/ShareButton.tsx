'use client';

import React, { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { buildShareUrl, buildDynamicShareUrl, formatCoordinates, type ViewportCoordinates } from '@/lib/deepLinkUtils';
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
    openRef?: MutableRefObject<(() => void) | null>;
}

export default function ShareButton({ viewport, onCaptureSnapshot, openRef }: ShareButtonProps) {
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
    const [snapshotId, setSnapshotId] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // Track the latest blob URL so we can revoke it on unmount
    const snapshotUrlRef = useRef<string | null>(null);
    useEffect(() => {
        snapshotUrlRef.current = snapshotUrl;
    }, [snapshotUrl]);

    // Revoke any outstanding blob URL when the component unmounts
    useEffect(() => {
        return () => {
            if (snapshotUrlRef.current) {
                URL.revokeObjectURL(snapshotUrlRef.current);
            }
        };
    }, []);

    // When snapshotId is available, update shareUrl to use the dynamic share page
    useEffect(() => {
        if (snapshotId) {
            setShareUrl(buildDynamicShareUrl(snapshotId, viewport));
        }
    }, [snapshotId, viewport]);

    const handleButtonClick = useCallback(async () => {
        // Start with the basic share URL
        setShareUrl(buildShareUrl(viewport));
        setShowModal(true);
        setSnapshotId(null);
        console.log('[Share] Modal opened');

        // Capture snapshot
        if (onCaptureSnapshot) {
            setIsCapturing(true);
            try {
                const blobUrl = await onCaptureSnapshot();
                setSnapshotUrl(blobUrl);
                console.log('[Share] Snapshot captured:', blobUrl ? 'success' : 'empty canvas');

                // Upload snapshot to server for dynamic OG image
                if (blobUrl) {
                    try {
                        const response = await fetch(blobUrl);
                        const blob = await response.blob();

                        const uploadResp = await fetch('/api/snapshot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'image/png' },
                            body: blob,
                        });

                        if (uploadResp.ok) {
                            const { id } = await uploadResp.json();
                            setSnapshotId(id);
                            console.log('[Share] ✅ Snapshot uploaded, id:', id);
                        } else {
                            console.warn('[Share] Snapshot upload failed:', uploadResp.status);
                        }
                    } catch (uploadErr) {
                        console.warn('[Share] Snapshot upload error:', uploadErr);
                    }
                }
            } catch (error) {
                console.error('[Share] Snapshot capture failed:', error);
                setSnapshotUrl(null);
            } finally {
                setIsCapturing(false);
            }
        }
    }, [viewport, onCaptureSnapshot]);

    // Expose open function to parent via ref
    useEffect(() => {
        if (openRef) {
            openRef.current = handleButtonClick;
        }
        return () => {
            if (openRef) {
                openRef.current = null;
            }
        };
    }, [openRef, handleButtonClick]);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setCustomMessage('');
        setSnapshotId(null);
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
                // Build share data with text
                const shareData: ShareData = {
                    title: 'Drawny - Draw with strangers',
                    text,
                };

                // If we have a snapshot, attach it as a file
                if (snapshotUrl) {
                    try {
                        const response = await fetch(snapshotUrl);
                        const blob = await response.blob();
                        const file = new File([blob], 'drawny-snapshot.png', { type: 'image/png' });

                        // Check if the browser supports sharing files
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            shareData.files = [file];
                            console.log('[Share] Attaching snapshot image to share');
                        } else {
                            console.log('[Share] File sharing not supported, sharing text only');
                        }
                    } catch (fileError) {
                        console.warn('[Share] Could not attach snapshot file:', fileError);
                    }
                }

                await navigator.share(shareData);
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
    }, [getShareMessage, getShareHashtag, shareUrl, snapshotUrl, copyToClipboard, handleCloseModal]);



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
