import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Types inlined to avoid importing from shared types (which would pull in Dexie)
interface SidebarTranscript {
  transcriptId: string;
  videoId: string;
  wordCount: number;
  notes: string;
}

interface SidebarSegment {
  segmentId: string;
  startMs: number;
  text: string;
}

interface SidebarVideo {
  title: string;
  channelTitle: string;
}

interface SidebarAnnotation {
  annotationId: string;
  segmentId: string;
  color: string;
  note: string;
}

interface SidebarData {
  transcript: SidebarTranscript | null;
  video: SidebarVideo | null;
  segments: SidebarSegment[];
  annotations: SidebarAnnotation[];
}

const TOGGLE_BUTTON_STYLES = `
  .ytm-sidebar-toggle {
    position: fixed; right: 0; top: 50%; transform: translateY(-50%);
    z-index: 9999; width: 32px; height: 80px; background: #2563eb;
    border: none; border-radius: 8px 0 0 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; box-shadow: -2px 0 8px rgba(0,0,0,0.2); transition: width 0.2s;
  }
  .ytm-sidebar-toggle:hover { width: 40px; }
`;

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  cssInjectionMode: 'manual',
  async main(ctx) {
    let reactMounted = false;

    const ui = await createShadowRootUi(ctx, {
      name: 'yt-transcript-sidebar',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        // Initially render only a lightweight plain-DOM toggle button (no React)
        const styleEl = document.createElement('style');
        styleEl.textContent = TOGGLE_BUTTON_STYLES;
        container.appendChild(styleEl);

        const btn = document.createElement('button');
        btn.className = 'ytm-sidebar-toggle';
        btn.title = 'Open Transcript Sidebar (Ctrl+Shift+Y)';
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>';
        container.appendChild(btn);

        function mountReact() {
          if (reactMounted) return;
          reactMounted = true;
          // Remove the plain-DOM toggle button and style; React takes over
          container.innerHTML = '';
          const root = createRoot(container);
          root.render(<SidebarApp initialOpen={true} />);
        }

        btn.addEventListener('click', mountReact);

        // Also listen for the keyboard shortcut to mount React on first use
        function handleKeyDown(e: KeyboardEvent) {
          if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
            e.preventDefault();
            mountReact();
            document.removeEventListener('keydown', handleKeyDown);
          }
        }
        document.addEventListener('keydown', handleKeyDown);

        // Return a cleanup handle
        return { handleKeyDown };
      },
      onRemove: (handle) => {
        if (handle?.handleKeyDown) {
          document.removeEventListener('keydown', handle.handleKeyDown);
        }
      },
    });

    ui.mount();
  },
});

const styles = `
  .ytm-sidebar-toggle {
    position: fixed; right: 0; top: 50%; transform: translateY(-50%);
    z-index: 9999; width: 32px; height: 80px; background: #2563eb;
    border: none; border-radius: 8px 0 0 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; box-shadow: -2px 0 8px rgba(0,0,0,0.2); transition: width 0.2s;
  }
  .ytm-sidebar-toggle:hover { width: 40px; }
  .ytm-sidebar {
    position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
    background: #fff; z-index: 9998; box-shadow: -4px 0 20px rgba(0,0,0,0.15);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.3s ease; color: #111827; font-size: 14px; line-height: 1.5;
  }
  .ytm-sidebar.closed { transform: translateX(100%); }
  .ytm-sidebar.open { transform: translateX(0); }
  .ytm-header {
    padding: 16px; border-bottom: 1px solid #e5e7eb;
    display: flex; align-items: center; justify-content: space-between; background: #f9fafb;
  }
  .ytm-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
  .ytm-close-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: #6b7280; border-radius: 4px;
  }
  .ytm-close-btn:hover { background: #e5e7eb; color: #111827; }
  .ytm-tabs { display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
  .ytm-tab {
    flex: 1; padding: 8px 12px; text-align: center; cursor: pointer;
    border: none; background: none; font-size: 13px; font-weight: 500;
    color: #6b7280; border-bottom: 2px solid transparent; transition: all 0.2s;
  }
  .ytm-tab:hover { color: #111827; background: #f3f4f6; }
  .ytm-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
  .ytm-content { flex: 1; overflow-y: auto; padding: 16px; }
  .ytm-empty { text-align: center; padding: 32px 16px; color: #9ca3af; }
  .ytm-empty p { margin: 4px 0; }
  .ytm-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
    border: none; transition: all 0.2s;
  }
  .ytm-btn-primary { background: #2563eb; color: white; }
  .ytm-btn-primary:hover { background: #1d4ed8; }
  .ytm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ytm-segment {
    padding: 8px; border-radius: 6px; margin-bottom: 4px;
    transition: background 0.15s; cursor: pointer;
  }
  .ytm-segment:hover { background: #f3f4f6; }
  .ytm-segment-time { font-size: 11px; color: #2563eb; font-weight: 500; margin-bottom: 2px; }
  .ytm-segment-text { font-size: 13px; color: #374151; }
  .ytm-annotation-badge {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;
  }
  .ytm-note-area {
    width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px;
    margin-top: 8px; box-sizing: border-box;
  }
  .ytm-note-area:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
  .ytm-status { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
  .ytm-status-success { background: #dcfce7; color: #166534; }
  .ytm-status-error { background: #fef2f2; color: #991b1b; }
  .ytm-status-info { background: #dbeafe; color: #1e40af; }
  .ytm-loading { text-align: center; padding: 24px; }
  .ytm-spinner {
    width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: #2563eb;
    border-radius: 50%; animation: ytm-spin 0.8s linear infinite; margin: 0 auto 8px;
  }
  @keyframes ytm-spin { to { transform: rotate(360deg); } }
  .ytm-video-info { margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 8px; }
  .ytm-video-title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
  .ytm-video-meta { font-size: 12px; color: #6b7280; }
  .ytm-ann-note {
    margin-top: 4px; padding: 6px 8px; background: #f9fafb; border-radius: 4px;
    font-size: 12px; color: #4b5563; font-style: italic;
  }
`;

function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rm = minutes % 60;
  const rs = seconds % 60;
  if (hours > 0) return `${hours}:${rm.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  return `${rm}:${rs.toString().padStart(2, '0')}`;
}

function getVideoId(): string | null {
  try { return new URL(window.location.href).searchParams.get('v'); }
  catch { return null; }
}

const colorMap: Record<string, string> = {
  yellow: '#fbbf24', green: '#34d399', blue: '#60a5fa',
  pink: '#f472b6', orange: '#fb923c', purple: '#a78bfa'
};

// Send message to background script for DB operations
async function sendMessage(type: string, payload?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.success) {
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

function SidebarApp({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [activeTab, setActiveTab] = useState<'transcript' | 'notes' | 'annotations'>('transcript');
  const [data, setData] = useState<SidebarData>({ transcript: null, video: null, segments: [], annotations: [] });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (isOpen) loadTranscriptData();
  }, [isOpen]);

  // Listen for URL changes (YouTube SPA navigation)
  useEffect(() => {
    let lastVideoId = getVideoId();
    const observer = new MutationObserver(() => {
      const currentVideoId = getVideoId();
      if (currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        if (isOpen) loadTranscriptData();
      }
    });
    const target = document.querySelector('title') || document.head;
    if (target) observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isOpen]);

  // Configurable keyboard shortcut (Ctrl+Shift+Y by default)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
        e.preventDefault();
        setIsOpen(p => !p);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadTranscriptData() {
    const videoId = getVideoId();
    if (!videoId) {
      setData({ transcript: null, video: null, segments: [], annotations: [] });
      return;
    }
    setIsLoading(true);
    try {
      const result = await sendMessage('GET_SIDEBAR_DATA', { videoId }) as SidebarData;
      setData(result);
      setNotes(result.transcript?.notes || '');
    } catch (error) {
      console.error('Error loading sidebar data:', error);
      setData({ transcript: null, video: null, segments: [], annotations: [] });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveNotes() {
    if (!data.transcript) return;
    setIsSavingNotes(true);
    try {
      await sendMessage('SAVE_SIDEBAR_NOTES', {
        transcriptId: data.transcript.transcriptId,
        notes
      });
      setStatus({ type: 'success', message: 'Notes saved!' });
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus({ type: 'error', message: 'Failed to save notes' });
    } finally {
      setIsSavingNotes(false);
    }
  }

  function handleSegmentClick(segment: SidebarSegment) {
    const seconds = Math.floor(segment.startMs / 1000);
    const videoElement = document.querySelector('video') as HTMLVideoElement | null;
    if (videoElement) videoElement.currentTime = seconds;
  }

  function getAnnotationColor(segmentId: string): string | null {
    return data.annotations.find(a => a.segmentId === segmentId)?.color || null;
  }

  const { transcript, video, segments, annotations } = data;

  return (
    <>
      <style>{styles}</style>

      {!isOpen && (
        <button className="ytm-sidebar-toggle" onClick={() => setIsOpen(true)} title="Open Transcript Sidebar (Ctrl+Shift+Y)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <div className={`ytm-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="ytm-header">
          <h2>Transcript Manager</h2>
          <button className="ytm-close-btn" onClick={() => setIsOpen(false)} title="Close (Ctrl+Shift+Y)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ytm-tabs">
          <button className={`ytm-tab ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => setActiveTab('transcript')}>
            Transcript
          </button>
          <button className={`ytm-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>
            Notes
          </button>
          <button className={`ytm-tab ${activeTab === 'annotations' ? 'active' : ''}`} onClick={() => setActiveTab('annotations')}>
            Annotations {annotations.length > 0 && `(${annotations.length})`}
          </button>
        </div>

        <div className="ytm-content">
          {status && <div className={`ytm-status ytm-status-${status.type}`}>{status.message}</div>}

          {isLoading ? (
            <div className="ytm-loading">
              <div className="ytm-spinner" />
              <p style={{ color: '#6b7280', fontSize: '13px' }}>Loading...</p>
            </div>
          ) : !getVideoId() ? (
            <div className="ytm-empty">
              <p style={{ fontSize: '15px', fontWeight: 500 }}>No video detected</p>
              <p style={{ fontSize: '13px' }}>Navigate to a YouTube video to see its transcript</p>
            </div>
          ) : !transcript ? (
            <div className="ytm-empty">
              <p style={{ fontSize: '15px', fontWeight: 500 }}>No saved transcript</p>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>
                Use the extension popup to save this video's transcript
              </p>
            </div>
          ) : activeTab === 'transcript' ? (
            <div>
              {video && (
                <div className="ytm-video-info">
                  <p className="ytm-video-title">{video.title}</p>
                  <p className="ytm-video-meta">
                    {video.channelTitle} - {transcript.wordCount} words - {segments.length} segments
                  </p>
                </div>
              )}
              {segments.map((segment) => {
                const annColor = getAnnotationColor(segment.segmentId);
                return (
                  <div
                    key={segment.segmentId}
                    className="ytm-segment"
                    onClick={() => handleSegmentClick(segment)}
                    style={annColor ? { borderLeft: `3px solid ${colorMap[annColor] || '#d1d5db'}`, paddingLeft: '12px' } : undefined}
                  >
                    <div className="ytm-segment-time">{formatTimestamp(segment.startMs)}</div>
                    <div className="ytm-segment-text">{segment.text}</div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'notes' ? (
            <div>
              <textarea
                className="ytm-note-area"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes here..."
                rows={8}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button className="ytm-btn ytm-btn-primary" onClick={handleSaveNotes} disabled={isSavingNotes}>
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          ) : activeTab === 'annotations' ? (
            <div>
              {annotations.length === 0 ? (
                <div className="ytm-empty">
                  <p style={{ fontSize: '15px', fontWeight: 500 }}>No annotations</p>
                  <p style={{ fontSize: '13px' }}>Highlight and annotate segments from the dashboard</p>
                </div>
              ) : (
                annotations.map((ann) => {
                  const segment = segments.find(s => s.segmentId === ann.segmentId);
                  if (!segment) return null;
                  return (
                    <div
                      key={ann.annotationId}
                      className="ytm-segment"
                      onClick={() => handleSegmentClick(segment)}
                      style={{ borderLeft: `3px solid ${colorMap[ann.color] || '#d1d5db'}`, paddingLeft: '12px', marginBottom: '8px' }}
                    >
                      <div className="ytm-segment-time">
                        <span className="ytm-annotation-badge" style={{ background: colorMap[ann.color] || '#d1d5db' }} />
                        {formatTimestamp(segment.startMs)}
                      </div>
                      <div className="ytm-segment-text">{segment.text}</div>
                      {ann.note && <div className="ytm-ann-note">{ann.note}</div>}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
