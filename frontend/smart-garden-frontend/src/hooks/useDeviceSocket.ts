import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';

// ============================================
// TYPES
// ============================================

export interface SensorEvent {
    soilMoisture?: number | null;
    soilMoisture2?: number | null;
    temperature?: number | null;
    humidity?: number | null;
    lightIntensity?: number | null;
    rainDetected?: boolean | null;
    rainIntensity?: number | null;
    ambientLight?: number | null;
    pumpState?: boolean | null;
    lightState?: boolean | null;
    ts?: number | null;
}

export interface StatusEvent {
    deviceCode?: string;
    status?: string;
    online?: boolean;
    manualMode?: boolean;
    pumpState?: boolean;
    lightState?: boolean;
    setPoint?: number;
    timestamp?: number;
    ts?: number;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseDeviceSocketOptions {
    /** Device code (MAC address) of the ESP32 to subscribe to */
    deviceCode: string | null;
    /** Callback khi nhận sensor data mới */
    onSensorData?: (data: SensorEvent) => void;
    /** Callback khi nhận status change */
    onStatusChange?: (data: StatusEvent) => void;
    /** Có tự invalidate React Query cache không (default: true) */
    autoInvalidate?: boolean;
    /** Backend WebSocket URL (default: ws://localhost:8081/api/ws) */
    wsUrl?: string;
    /** Tắt hook (khi chưa có device) */
    enabled?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_WS_URL = 'ws://localhost:8081/api/ws';

/** Reconnect delays: 1s, 2s, 4s, 8s, 16s, 30s, 30s... */
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

// ============================================
// HOOK: useDeviceSocket
// ============================================

/**
 * Custom hook kết nối WebSocket STOMP để nhận dữ liệu real-time từ ESP32.
 *
 * Features:
 * 1️⃣ Heartbeat ping/pong (25s, cấu hình phía server)
 * 2️⃣ Auto reconnect với exponential backoff
 * 3️⃣ Channel subscription theo deviceCode
 * 4️⃣ Broadcast theo event (sensor, status)
 * 5️⃣ Close socket khi rời trang (cleanup)
 * 6️⃣ Rate limit / batching (debounce React Query invalidation)
 * 7️⃣ Cleanup connection (unmount = disconnect)
 */
export function useDeviceSocket({
    deviceCode,
    onSensorData,
    onStatusChange,
    autoInvalidate = true,
    wsUrl = DEFAULT_WS_URL,
    enabled = true,
}: UseDeviceSocketOptions) {
    const queryClient = useQueryClient();
    const clientRef = useRef<Client | null>(null);
    const subscriptionsRef = useRef<StompSubscription[]>([]);
    const reconnectAttemptRef = useRef(0);
    const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

    // Store latest callbacks in ref to avoid re-creating STOMP client
    const onSensorRef = useRef(onSensorData);
    const onStatusRef = useRef(onStatusChange);
    onSensorRef.current = onSensorData;
    onStatusRef.current = onStatusChange;

    // ---- 6️⃣ Rate-limited query invalidation (debounce 500ms) ----
    const debouncedInvalidate = useCallback(
        (queryKeys: string[][]) => {
            if (!autoInvalidate) return;
            if (invalidateTimerRef.current) {
                clearTimeout(invalidateTimerRef.current);
            }
            invalidateTimerRef.current = setTimeout(() => {
                queryKeys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
                invalidateTimerRef.current = null;
            }, 500);
        },
        [autoInvalidate, queryClient]
    );

    // ---- 3️⃣ Subscribe to device channels ----
    const subscribeToDevice = useCallback(
        (client: Client, code: string) => {
            // Unsubscribe previous
            subscriptionsRef.current.forEach((sub) => {
                try { sub.unsubscribe(); } catch { /* ignore */ }
            });
            subscriptionsRef.current = [];

            // Subscribe sensor channel
            const sensorSub = client.subscribe(
                `/topic/devices/${code}/sensor`,
                (message: IMessage) => {
                    try {
                        const data: SensorEvent = JSON.parse(message.body);
                        // 4️⃣ Broadcast theo event
                        onSensorRef.current?.(data);

                        // 6️⃣ Debounced invalidation
                        debouncedInvalidate([['sensorLatest']]);
                    } catch (e) {
                        console.warn('[WS] Invalid sensor message:', e);
                    }
                }
            );

            // Subscribe status channel
            const statusSub = client.subscribe(
                `/topic/devices/${code}/status`,
                (message: IMessage) => {
                    try {
                        const data: StatusEvent = JSON.parse(message.body);
                        // 4️⃣ Broadcast theo event
                        onStatusRef.current?.(data);

                        // 6️⃣ Debounced invalidation
                        debouncedInvalidate([['myDevices']]);
                    } catch (e) {
                        console.warn('[WS] Invalid status message:', e);
                    }
                }
            );

            subscriptionsRef.current = [sensorSub, statusSub];
            console.log(`[WS] Subscribed to device: ${code}`);
        },
        [debouncedInvalidate]
    );

    // ---- Main effect: connect/disconnect ----
    useEffect(() => {
        if (!enabled || !deviceCode) {
            setConnectionState('disconnected');
            return;
        }

        const client = new Client({
            // Native WebSocket (no SockJS needed)
            brokerURL: wsUrl,

            // 1️⃣ Heartbeat: client gửi mỗi 25s, nhận mỗi 25s
            heartbeatIncoming: 25000,
            heartbeatOutgoing: 25000,

            // 2️⃣ Auto reconnect: exponential backoff
            reconnectDelay: 0, // Tắt auto reconnect mặc định, tự quản lý

            onConnect: () => {
                console.log('[WS] Connected to', wsUrl);
                setConnectionState('connected');
                reconnectAttemptRef.current = 0;

                // 3️⃣ Subscribe to device channel
                subscribeToDevice(client, deviceCode);
            },

            onStompError: (frame) => {
                console.error('[WS] STOMP error:', frame.headers['message'], frame.body);
                setConnectionState('error');
            },

            onWebSocketClose: () => {
                console.log('[WS] Connection closed');
                setConnectionState('disconnected');

                // 2️⃣ Auto reconnect with exponential backoff
                const attempt = reconnectAttemptRef.current;
                const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
                reconnectAttemptRef.current = attempt + 1;
                console.log(`[WS] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

                setTimeout(() => {
                    if (clientRef.current === client) {
                        setConnectionState('connecting');
                        try {
                            client.activate();
                        } catch {
                            // silently fail, will retry
                        }
                    }
                }, delay);
            },

            onWebSocketError: (evt) => {
                console.warn('[WS] WebSocket error:', evt);
                setConnectionState('error');
            },
        });

        clientRef.current = client;
        setConnectionState('connecting');
        client.activate();

        // 5️⃣ + 7️⃣ Cleanup: close socket khi rời trang / unmount
        return () => {
            console.log('[WS] Cleaning up connection');
            clientRef.current = null;

            // Clear debounce timer
            if (invalidateTimerRef.current) {
                clearTimeout(invalidateTimerRef.current);
                invalidateTimerRef.current = null;
            }

            // Unsubscribe all
            subscriptionsRef.current.forEach((sub) => {
                try { sub.unsubscribe(); } catch { /* ignore */ }
            });
            subscriptionsRef.current = [];

            // Deactivate client
            try {
                client.deactivate();
            } catch {
                // ignore
            }
        };
    }, [deviceCode, enabled, wsUrl, subscribeToDevice]);

    // ---- Handle deviceCode change without full reconnect ----
    const previousDeviceCode = useRef(deviceCode);
    useEffect(() => {
        if (previousDeviceCode.current !== deviceCode && deviceCode && clientRef.current?.connected) {
            subscribeToDevice(clientRef.current, deviceCode);
        }
        previousDeviceCode.current = deviceCode;
    }, [deviceCode, subscribeToDevice]);

    return {
        /** Current connection state */
        connectionState,
        /** Whether currently connected */
        isConnected: connectionState === 'connected',
    };
}
