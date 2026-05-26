import { databaseService } from './DatabaseService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
    id: string;
    username: string;
    message: string;
    timestamp: number;
}

class ChatStorage {
    private messages: ChatMessage[] = [];
    private chatStartTime: number = Date.now();
    private readonly resetIntervalMs = 12 * 60 * 60 * 1000; // 12 hours
    private readonly stateFile = path.join(process.cwd(), '.chat_state.json');

    constructor() {
        this.loadState();
        this.loadMessagesFromDb().catch(err => {
            console.error('[ChatStorage] Error loading messages from DB on startup:', err);
        });
    }

    private loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = fs.readFileSync(this.stateFile, 'utf-8');
                const parsed = JSON.parse(data);
                if (parsed.chatStartTime) {
                    this.chatStartTime = Number(parsed.chatStartTime);
                    console.log('[ChatStorage] Loaded chatStartTime from file:', new Date(this.chatStartTime).toISOString());
                }
            } else {
                this.saveState();
            }
        } catch (err) {
            console.error('[ChatStorage] Error loading chat state:', err);
        }
    }

    private saveState() {
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify({ chatStartTime: this.chatStartTime }), 'utf-8');
        } catch (err) {
            console.error('[ChatStorage] Error saving chat state:', err);
        }
    }

    private async loadMessagesFromDb() {
        if (!databaseService.isAvailable()) {
            console.log('[ChatStorage] Database not available, using empty memory cache');
            return;
        }

        try {
            // Load messages since chatStartTime
            const msgs = await databaseService.getChatMessages(this.chatStartTime);
            this.messages = msgs;
            console.log(`[ChatStorage] Loaded ${this.messages.length} messages from DB`);
        } catch (err) {
            console.error('[ChatStorage] Failed to load messages from DB:', err);
        }
    }

    async addMessage(username: string, message: string): Promise<ChatMessage> {
        const msg: ChatMessage = {
            id: uuidv4(),
            username,
            message,
            timestamp: Date.now(),
        };

        this.messages.push(msg);

        // Keep memory array capped to prevent leaks if DB is disabled
        if (this.messages.length > 500) {
            this.messages.shift();
        }

        if (databaseService.isAvailable()) {
            await databaseService.saveChatMessage(msg);
        }

        return msg;
    }

    getMessages(): ChatMessage[] {
        // Return messages that belong to the current cycle
        return this.messages.filter(m => m.timestamp >= this.chatStartTime);
    }

    shouldReset(): boolean {
        return Date.now() - this.chatStartTime >= this.resetIntervalMs;
    }

    getTimeUntilReset(): number {
        return Math.max(0, this.resetIntervalMs - (Date.now() - this.chatStartTime));
    }

    getStartTime(): number {
        return this.chatStartTime;
    }

    async reset(): Promise<void> {
        console.log('[ChatStorage] Resetting chat...');
        this.messages = [];
        this.chatStartTime = Date.now();
        this.saveState();

        if (databaseService.isAvailable()) {
            try {
                await databaseService.clearChatMessages();
                console.log('[ChatStorage] Wiped chat messages from database');
            } catch (err) {
                console.error('[ChatStorage] Failed to clear chat messages in DB:', err);
            }
        }
    }
}

// Global singleton
const globalForChatStorage = globalThis as unknown as {
    chatStorage: ChatStorage | undefined;
};

export const chatStorage = globalForChatStorage.chatStorage ?? new ChatStorage();

if (process.env.NODE_ENV !== 'production') {
    globalForChatStorage.chatStorage = chatStorage;
} else {
    globalForChatStorage.chatStorage = chatStorage;
}
