// RedMist SignalR Real-Time Connection
// Based on: https://docs.redmist.racing/articles/signalr-hubs.html

import * as signalR from '@microsoft/signalr';
import pako from 'pako';
import { tokenManager } from './auth';
import type { SessionState, ControlLogEntry, InCarPayload } from '../types/redmist';

// SignalR hub URL - direct WebSocket connection (skipping negotiation)
const STATUS_HUB_URL = 'wss://api.redmist.racing/status/event-status';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface SignalRCallbacks {
  onSessionUpdate?: (session: Partial<SessionState>) => void;
  onCarUpdate?: (cars: unknown) => void;
  onControlLogUpdate?: (entries: ControlLogEntry[]) => void;
  onInCarUpdate?: (payload: InCarPayload) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

class RedMistSignalRClient {
  private connection: signalR.HubConnection | null = null;
  private callbacks: SignalRCallbacks = {};
  private subscribedEventId: number | null = null;
  private subscribedCar: string | null = null;
  private connectionState: ConnectionState = 'disconnected';

  /**
   * Set callbacks for handling events
   */
  setCallbacks(callbacks: SignalRCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Update and notify connection state
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.callbacks.onConnectionStateChange?.(state);
  }

  /**
   * Connect to the StatusHub
   */
  async connect(): Promise<void> {
    if (this.connection) {
      console.log('[SignalR] Already connected or connecting');
      return;
    }

    this.setConnectionState('connecting');

    try {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(STATUS_HUB_URL, {
          accessTokenFactory: () => tokenManager.getToken(),
          // Skip negotiation and use WebSockets directly to avoid CORS issues
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff: 0, 2, 10, 30 seconds, then 30 seconds max
            if (retryContext.previousRetryCount === 0) return 0;
            if (retryContext.previousRetryCount === 1) return 2000;
            if (retryContext.previousRetryCount === 2) return 10000;
            return 30000;
          },
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Handle reconnection events
      this.connection.onreconnecting((error) => {
        console.log('[SignalR] Connection lost. Reconnecting...', error);
        this.setConnectionState('reconnecting');
      });

      this.connection.onreconnected(async (connectionId) => {
        console.log('[SignalR] Reconnected with connection ID:', connectionId);
        this.setConnectionState('connected');
        
        // Re-subscribe to events after reconnection
        await this.resubscribe();
      });

      this.connection.onclose((error) => {
        console.log('[SignalR] Connection closed.', error);
        this.setConnectionState('disconnected');
        
        if (error) {
          this.callbacks.onError?.(error);
        }
      });

      // Handle incoming messages
      this.setupMessageHandlers();

      // Start connection
      await this.connection.start();
      console.log('[SignalR] Connected to StatusHub');
      this.setConnectionState('connected');
    } catch (error) {
      console.error('[SignalR] Connection failed:', error);
      this.setConnectionState('disconnected');
      this.connection = null;
      throw error;
    }
  }

  /**
   * Setup handlers for incoming messages
   */
  private setupMessageHandlers(): void {
    if (!this.connection) return;

    // Main message handler - receives gzipped or JSON data
    this.connection.on('ReceiveMessage', (message: string) => {
      try {
        const data = this.decompressMessage(message);
        this.handleMessage(data);
      } catch (error) {
        console.error('[SignalR] Failed to process message:', error);
      }
    });

    // Session patch updates (V2)
    this.connection.on('ReceiveSessionPatch', (session: Partial<SessionState>) => {
      console.log('[SignalR] Session patch received');
      this.callbacks.onSessionUpdate?.(session);
    });

    // Car position patches (V2)
    this.connection.on('ReceiveCarPatches', (cars: unknown) => {
      console.log('[SignalR] Car patches received');
      this.callbacks.onCarUpdate?.(cars);
    });

    // Control log updates
    this.connection.on('ReceiveControlLog', (entries: ControlLogEntry[]) => {
      console.log('[SignalR] Control log update received');
      this.callbacks.onControlLogUpdate?.(entries);
    });

    // In-car payload updates
    this.connection.on('ReceiveInCarPayload', (payload: InCarPayload) => {
      console.log('[SignalR] In-car payload received');
      this.callbacks.onInCarUpdate?.(payload);
    });
  }

  /**
   * Decompress gzipped message or parse JSON directly
   */
  private decompressMessage(message: string): unknown {
    // Check if message is gzipped (starts with 'H4sI' which is base64-encoded gzip)
    if (message.startsWith('H4sI')) {
      const binaryString = atob(message);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decompressed = pako.inflate(bytes, { to: 'string' });
      return JSON.parse(decompressed);
    }
    
    // Parse JSON directly
    return JSON.parse(message);
  }

  /**
   * Handle decompressed message
   */
  private handleMessage(data: unknown): void {
    const message = data as Record<string, unknown>;
    
    // Check message type
    if (message.t === 'patch' && Array.isArray(message.patches)) {
      // Apply JSON patches
      console.log('[SignalR] Patch message received');
      // Patches would be applied to the current session state
    } else if (message.eventId !== undefined || message.sessionId !== undefined) {
      // Full session state update
      console.log('[SignalR] Full session state received');
      this.callbacks.onSessionUpdate?.(message as Partial<SessionState>);
    } else if (message.cps || message.carPositions) {
      // Car positions update
      this.callbacks.onCarUpdate?.(message);
    }
  }

  /**
   * Subscribe to event updates (V2)
   */
  async subscribeToEvent(eventId: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to SignalR hub');
    }

    try {
      await this.connection.invoke('SubscribeToEventV2', eventId);
      this.subscribedEventId = eventId;
      console.log(`[SignalR] Subscribed to event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to subscribe to event:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from event updates (V2)
   */
  async unsubscribeFromEvent(eventId: number): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.invoke('UnsubscribeFromEventV2', eventId);
      if (this.subscribedEventId === eventId) {
        this.subscribedEventId = null;
      }
      console.log(`[SignalR] Unsubscribed from event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to unsubscribe from event:', error);
    }
  }

  /**
   * Subscribe to control log updates
   */
  async subscribeToControlLogs(eventId: number): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to SignalR hub');
    }

    try {
      await this.connection.invoke('SubscribeToControlLogs', eventId);
      console.log(`[SignalR] Subscribed to control logs for event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to subscribe to control logs:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from control log updates
   */
  async unsubscribeFromControlLogs(eventId: number): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.invoke('UnsubscribeFromControlLogs', eventId);
      console.log(`[SignalR] Unsubscribed from control logs for event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to unsubscribe from control logs:', error);
    }
  }

  /**
   * Subscribe to car-specific control logs
   */
  async subscribeToCarControlLogs(eventId: number, carNumber: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to SignalR hub');
    }

    try {
      await this.connection.invoke('SubscribeToCarControlLogs', eventId, carNumber);
      console.log(`[SignalR] Subscribed to control logs for car ${carNumber} in event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to subscribe to car control logs:', error);
      throw error;
    }
  }

  /**
   * Subscribe to in-car driver mode
   */
  async subscribeToInCarDriverEvent(eventId: number, carNumber: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to SignalR hub');
    }

    try {
      await this.connection.invoke('SubscribeToInCarDriverEvent', eventId, carNumber);
      this.subscribedCar = carNumber;
      console.log(`[SignalR] Subscribed to in-car mode for car ${carNumber} in event ${eventId}`);
    } catch (error) {
      console.error('[SignalR] Failed to subscribe to in-car driver event:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from in-car driver mode
   */
  async unsubscribeFromInCarDriverEvent(eventId: number, carNumber: string): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.invoke('UnsubscribeFromInCarDriverEvent', eventId, carNumber);
      if (this.subscribedCar === carNumber) {
        this.subscribedCar = null;
      }
      console.log(`[SignalR] Unsubscribed from in-car mode for car ${carNumber}`);
    } catch (error) {
      console.error('[SignalR] Failed to unsubscribe from in-car driver event:', error);
    }
  }

  /**
   * Re-subscribe to events after reconnection
   */
  private async resubscribe(): Promise<void> {
    if (this.subscribedEventId) {
      await this.subscribeToEvent(this.subscribedEventId);
      await this.subscribeToControlLogs(this.subscribedEventId);
    }
    
    if (this.subscribedEventId && this.subscribedCar) {
      await this.subscribeToInCarDriverEvent(this.subscribedEventId, this.subscribedCar);
    }
  }

  /**
   * Disconnect from the hub
   */
  async disconnect(): Promise<void> {
    if (!this.connection) return;

    try {
      // Unsubscribe from all events
      if (this.subscribedEventId) {
        await this.unsubscribeFromEvent(this.subscribedEventId);
        await this.unsubscribeFromControlLogs(this.subscribedEventId);
      }
      
      if (this.subscribedEventId && this.subscribedCar) {
        await this.unsubscribeFromInCarDriverEvent(this.subscribedEventId, this.subscribedCar);
      }

      await this.connection.stop();
      console.log('[SignalR] Disconnected from StatusHub');
    } catch (error) {
      console.error('[SignalR] Error during disconnect:', error);
    } finally {
      this.connection = null;
      this.subscribedEventId = null;
      this.subscribedCar = null;
      this.setConnectionState('disconnected');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Get currently subscribed event ID
   */
  getSubscribedEventId(): number | null {
    return this.subscribedEventId;
  }
}

// Export singleton instance
export const signalRClient = new RedMistSignalRClient();

