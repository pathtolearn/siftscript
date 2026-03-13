import type { MessageType, ExtensionResponse } from '../../types';
import type { MessagePayload, MessageResponse } from './types';

export class MessagingService {
  private static instance: MessagingService;
  private handlers: Map<MessageType, (payload: unknown) => Promise<unknown>> = new Map();

  private constructor() {}

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  // Register a handler for a specific message type
  registerHandler<T extends MessageType>(
    type: T,
    handler: (payload: MessagePayload<T>) => Promise<MessageResponse<T>>
  ): void {
    this.handlers.set(type, handler as (payload: unknown) => Promise<unknown>);
  }

  // Send a message and wait for response
  async sendMessage<T extends MessageType>(
    type: T,
    payload: MessagePayload<T>
  ): Promise<MessageResponse<T>> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type, payload },
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response.success) {
            reject(new Error(response.error || 'Unknown error'));
            return;
          }

          resolve(response.data as MessageResponse<T>);
        }
      );
    });
  }

  // Send message to a specific tab
  async sendMessageToTab<T extends MessageType>(
    tabId: number,
    type: T,
    payload: MessagePayload<T>
  ): Promise<MessageResponse<T>> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type, payload },
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response.success) {
            reject(new Error(response.error || 'Unknown error'));
            return;
          }

          resolve(response.data as MessageResponse<T>);
        }
      );
    });
  }

  // Handle incoming messages (should be called in background script)
  setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message as { type: MessageType; payload: unknown };
      const handler = this.handlers.get(type);

      if (!handler) {
        sendResponse({ success: false, error: `No handler for message type: ${type}` });
        return true;
      }

      handler(payload)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((error) => {
          console.error(`Error handling message ${type}:`, error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });

      return true; // Keep channel open for async response
    });
  }

  // Setup listener for content script (should be called in content script)
  setupContentScriptListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message as { type: MessageType; payload: unknown };
      const handler = this.handlers.get(type);

      if (!handler) {
        return false; // Not handled
      }

      handler(payload)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((error) => {
          console.error(`Error handling message ${type}:`, error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });

      return true;
    });
  }
}

export const messaging = MessagingService.getInstance();
