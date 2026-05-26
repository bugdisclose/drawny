'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, ChatMessage, ChatHistoryData } from '@/types';
import { trackEvent } from '@/lib/analytics';
import { playMentionSound } from '@/lib/soundUtils';
import styles from './ChatDrawer.module.css';

interface ChatDrawerProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    isConnected: boolean;
    userName: string;
}

export default function ChatDrawer({ socket, isConnected, userName }: ChatDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasUnreadTag, setHasUnreadTag] = useState(false);
    const [showTagNudge, setShowTagNudge] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const [chatStartTime, setChatStartTime] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<string>('12:00:00');
    
    // Draggable toggle button states
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

    // Nudge states
    const [showNudge, setShowNudge] = useState(false);

    const feedEndRef = useRef<HTMLDivElement | null>(null);
    const feedRef = useRef<HTMLDivElement | null>(null);
    const chatInputRef = useRef<HTMLInputElement | null>(null);

    // Scroll to bottom helper
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (feedEndRef.current) {
            feedEndRef.current.scrollIntoView({ behavior });
        }
    }, []);

    const handleOpenChat = useCallback(() => {
        setIsOpen(true);
        setUnreadCount(0);
        setHasUnreadTag(false);
        setShowTagNudge(false);
        setShowNudge(false);
        setTimeout(() => scrollToBottom('auto'), 50);
    }, [scrollToBottom]);

    const handleMentionUser = useCallback((senderName: string) => {
        const cleanName = senderName.startsWith('@') ? senderName : `@${senderName}`;
        setInputVal(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return `${cleanName} `;
            if (trimmed.endsWith(cleanName)) return `${prev} `;
            return `${prev} ${cleanName} `;
        });
        setTimeout(() => {
            if (chatInputRef.current) {
                chatInputRef.current.focus();
            }
        }, 30);
    }, []);

    // Only show nudge if chat has never been opened in this session
    useEffect(() => {
        const hasBeenNudged = sessionStorage.getItem('drawny_chat_nudged');
        if (hasBeenNudged || isOpen) return;

        const timer = setTimeout(() => {
            setShowNudge(true);
            sessionStorage.setItem('drawny_chat_nudged', 'true');
        }, 3500);

        return () => clearTimeout(timer);
    }, [isOpen]);

    const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const container = document.querySelector(`.${styles.chatContainer}`);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        
        dragStartRef.current = {
            x: clientX,
            y: clientY,
            posX: dragPosition ? dragPosition.x : rect.left,
            posY: dragPosition ? dragPosition.y : rect.top,
        };
        isDraggingRef.current = false;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (moveEvent.cancelable) {
                moveEvent.preventDefault();
            }
            const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = moveX - dragStartRef.current.x;
            const dy = moveY - dragStartRef.current.y;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDraggingRef.current = true;
            }

            // Keep within window bounds
            const newX = Math.max(10, Math.min(window.innerWidth - 70, dragStartRef.current.posX + dx));
            const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.posY + dy));

            setDragPosition({ x: newX, y: newY });
        };

        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
    };

    const handleButtonClick = (e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        handleOpenChat();
    };

    const dismissNudge = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowNudge(false);
    };

    // Handle incoming messages and history
    useEffect(() => {
        if (!socket) return;

        const handleChatHistory = (data: ChatHistoryData) => {
            console.log('[Chat] Received history:', data.messages.length, 'messages. Cycle start:', new Date(data.startTime).toISOString());
            setMessages(data.messages);
            setChatStartTime(data.startTime);
            if (isOpen) {
                setTimeout(() => scrollToBottom('auto'), 50);
            }
        };

        const handleChatMessage = (msg: ChatMessage) => {
            console.log('[Chat] New message from:', msg.username);
            setMessages(prev => [...prev, msg]);

            const isSelf = msg.username === userName;
            const isMention = !isSelf && msg.message.toLowerCase().includes(`@${userName.toLowerCase()}`);

            if (isMention) {
                playMentionSound();
                if (!isOpen) {
                    setHasUnreadTag(true);
                    setShowTagNudge(true);
                }
            }

            // Increment unread count if panel is closed
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            } else {
                // Scroll if user is near bottom
                const feed = feedRef.current;
                if (feed) {
                    const isNearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
                    if (isNearBottom) {
                        setTimeout(() => scrollToBottom('smooth'), 50);
                    }
                }
            }
        };

        socket.on('chat:history', handleChatHistory);
        socket.on('chat:message', handleChatMessage);

        // Request chat history explicitly (resolves socket listener race condition)
        socket.emit('chat:request-history');

        return () => {
            socket.off('chat:history', handleChatHistory);
            socket.off('chat:message', handleChatMessage);
        };
    }, [socket, isOpen, scrollToBottom, userName]);

    // Countdown Timer logic (12-hour cycle)
    useEffect(() => {
        if (!chatStartTime) return;

        const updateCountdown = () => {
            const resetIntervalMs = 12 * 60 * 60 * 1000; // 12 hours
            const elapsed = Date.now() - chatStartTime;
            const remaining = Math.max(0, resetIntervalMs - elapsed);

            if (remaining === 0) {
                setTimeRemaining('00:00:00');
                return;
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            const pad = (n: number) => n.toString().padStart(2, '0');
            setTimeRemaining(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [chatStartTime]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!socket || !isConnected) return;
        const msgText = inputVal.trim();
        if (!msgText || msgText.length > 500) return;

        socket.emit('chat:message', {
            username: userName,
            message: msgText
        });
        setInputVal('');
        // Force scroll on user send
        setTimeout(() => scrollToBottom('smooth'), 50);
    };

    const formatTimestamp = (ts: number): string => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div 
            className={styles.chatContainer}
            style={dragPosition ? {
                left: dragPosition.x,
                top: dragPosition.y,
                right: 'auto',
                bottom: 'auto',
                position: 'fixed'
            } : undefined}
        >
            {/* Nudge Tooltip */}
            {!isOpen && (showTagNudge || showNudge) && (
                <div className={`${styles.chatNudgeTooltip} ${showTagNudge ? styles.nudgeTagged : ''}`}>
                    <span>{showTagNudge ? 'Mentioned in chat! 🔔' : 'Chat with strangers! 💬'}</span>
                    <button 
                        className={styles.closeNudgeBtn} 
                        onClick={(e) => {
                            if (showTagNudge) {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowTagNudge(false);
                            } else {
                                dismissNudge(e);
                            }
                        }} 
                        aria-label="Dismiss nudge"
                    >×</button>
                </div>
            )}

            {/* Floating Toggle Button */}
            {!isOpen && (
                <button
                    className={`${styles.chatToggleBtn} ${hasUnreadTag ? styles.tagPulsate : (showNudge ? styles.nudgePulsate : '')}`}
                    onClick={handleButtonClick}
                    onMouseDown={handleStartDrag}
                    onTouchStart={handleStartDrag}
                    aria-label="Open Chat"
                    title="Open Chat"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {(unreadCount > 0 || hasUnreadTag) && (
                        <span className={`${styles.unreadBadge} ${hasUnreadTag ? styles.badgeTagged : ''}`}>
                            {hasUnreadTag ? '@' : (unreadCount > 99 ? '99+' : unreadCount)}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Panel */}
            <div className={`${styles.drawerPanel} ${isOpen ? styles.drawerPanelOpen : ''}`}>
                {/* Header */}
                <div className={styles.drawerHeader}>
                    <div className={styles.headerInfo}>
                        <h2 className={styles.headerTitle}>Anonymous Chat</h2>
                        <div className={styles.userIdentity}>
                            <span>You: <strong className={styles.identityName}>{userName}</strong></span>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <a
                            href="https://forms.gle/ghLEGyZ8dPkTx1GB6"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.feedbackBtn}
                            title="Share feedback"
                            aria-label="Share feedback"
                            onClick={() => trackEvent('feedback_button_click', { destination: 'google_form', location: 'chat_drawer' })}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </a>
                        <button
                            className={styles.closeBtn}
                            onClick={() => setIsOpen(false)}
                            aria-label="Close Chat"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Reset Timer Info */}
                <div className={styles.infoBar}>
                    <svg className={styles.infoIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Messages wipe clean in {timeRemaining}</span>
                </div>

                {/* Messages Feed */}
                <div ref={feedRef} className={styles.messageFeed}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 8 }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span className={styles.emptyTitle}>Silence is golden...</span>
                            <span className={styles.emptyText}>No messages yet. Be the first to break the ice!</span>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            // Check if message is a system notification
                            if (msg.username === 'System' || msg.id.startsWith('system-')) {
                                return (
                                    <div key={msg.id} className={styles.msgSystem}>
                                        {msg.message}
                                    </div>
                                );
                            }

                            const isSelf = msg.username === userName;
                            const isMention = !isSelf && msg.message.toLowerCase().includes(`@${userName.toLowerCase()}`);
                            return (
                                <div
                                    key={msg.id}
                                    className={`${styles.messageRow} ${isSelf ? styles.msgSelf : styles.msgOther} ${isMention ? styles.msgTagged : ''}`}
                                >
                                    {!isSelf && (
                                        <span 
                                            className={styles.msgSender}
                                            onClick={() => handleMentionUser(msg.username)}
                                            title={`Reply/Mention ${msg.username}`}
                                        >
                                            {msg.username}
                                        </span>
                                    )}
                                    <div 
                                        className={`${styles.msgBubble} ${isSelf ? styles.bubbleSelf : styles.bubbleOther}`}
                                        onClick={!isSelf ? () => handleMentionUser(msg.username) : undefined}
                                        style={!isSelf ? { cursor: 'pointer' } : undefined}
                                        title={!isSelf ? `Reply to ${msg.username}` : undefined}
                                    >
                                        {msg.message}
                                    </div>
                                    <span className={styles.msgMeta}>{formatTimestamp(msg.timestamp)}</span>
                                </div>
                            );
                        })
                    )}
                    <div ref={feedEndRef} />
                </div>

                {/* Footer Input */}
                <div className={styles.drawerFooter}>
                    <form className={styles.inputForm} onSubmit={handleSendMessage}>
                        <input
                            ref={chatInputRef}
                            type="text"
                            className={styles.chatInput}
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder={isConnected ? "Type a message..." : "Connecting..."}
                            maxLength={500}
                            disabled={!isConnected}
                        />
                        <button
                            type="submit"
                            className={styles.sendBtn}
                            disabled={!isConnected || !inputVal.trim()}
                            aria-label="Send message"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </form>
                    <div className={styles.inputMeta}>
                        {!isConnected && <span className={styles.offlineWarning}>Offline - connecting...</span>}
                        {isConnected && <span />}
                        <span>{inputVal.length}/500</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
