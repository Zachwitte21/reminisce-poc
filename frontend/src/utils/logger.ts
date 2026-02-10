import { CONFIG } from '../config';

const API_URL = CONFIG.API_BASE_URL;


type LogLevel = 'info' | 'warn' | 'error';

class RemoteLogger {
    private send(level: LogLevel, ...args: unknown[]): void {
        const message = args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(' ');

        if (level === 'error') {
            console.error(...args);
        } else if (level === 'warn') {
            console.warn(...args);
        } else {
            console.log(...args);
        }

        if (CONFIG.ENABLE_REMOTE_LOGGING) {
            fetch(`${API_URL}/api/client-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message }),
            }).catch(() => {
                // Ignore network errors for logger
            });
        }
    }

    info(...args: unknown[]): void {
        this.send('info', ...args);
    }

    warn(...args: unknown[]): void {
        this.send('warn', ...args);
    }

    error(...args: unknown[]): void {
        this.send('error', ...args);
    }
}

export const logger = new RemoteLogger();
