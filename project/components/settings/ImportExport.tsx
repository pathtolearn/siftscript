import { useState, useRef } from 'react';
import { Download, Upload, FileJson, FileText, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { exportAllData, downloadJson, downloadText, downloadCsv, formatTranscriptAsText, formatTranscriptsAsCsv } from '../../lib/utils/export';
import { importFromJson, parseImportFile, type ImportResult } from '../../lib/utils/import';
import { transcriptRepository } from '../../lib/db/repositories/transcriptRepository';
import { videoRepository } from '../../lib/db/repositories/videoRepository';
import { segmentRepository } from '../../lib/db/repositories/segmentRepository';
import { categoryRepository } from '../../lib/db/repositories/categoryRepository';
import type { Transcript, Video, Category } from '../../types';

export function ImportExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExportAll() {
    try {
      setIsExporting(true);
      const data = await exportAllData();
      const filename = `yt-transcript-backup-${new Date().toISOString().split('T')[0]}.json`;
      downloadJson(data, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportTxt() {
    try {
      setIsExporting(true);
      const transcripts = await transcriptRepository.getAll();
      
      for (const transcript of transcripts) {
        const [video, segments] = await Promise.all([
          videoRepository.getById(transcript.videoId),
          segmentRepository.getByTranscriptId(transcript.transcriptId)
        ]);
        
        if (video && segments.length > 0) {
          const content = formatTranscriptAsText(video.title, video.channelTitle, video.url, segments);
          const filename = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
          downloadText(content, filename);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCsv() {
    try {
      setIsExporting(true);
      const transcripts = await transcriptRepository.getAll();
      
      const enriched = await Promise.all(
        transcripts.map(async (transcript) => {
          const [video, category] = await Promise.all([
            videoRepository.getById(transcript.videoId),
            transcript.categoryId ? categoryRepository.getById(transcript.categoryId) : Promise.resolve(undefined)
          ]);
          return { transcript, video, category };
        })
      );
      
      const csv = formatTranscriptsAsCsv(enriched);
      const filename = `yt-transcript-metadata-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCsv(csv, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) return;

    try {
      setIsImporting(true);
      const data = await parseImportFile(selectedFile);
      const result = await importFromJson(data, importMode);
      setImportResult(result);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Data
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleExportAll}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileJson className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Full Backup</p>
              <p className="text-sm text-gray-500">Export all data as JSON</p>
            </div>
          </button>

          <button
            onClick={handleExportTxt}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Transcripts (TXT)</p>
              <p className="text-sm text-gray-500">Export all transcripts as text files</p>
            </div>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Metadata (CSV)</p>
              <p className="text-sm text-gray-500">Export metadata spreadsheet</p>
            </div>
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Data
        </h3>
        
        {!importResult ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center"
              >
                <FileJson className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile ? selectedFile.name : 'Click to select backup file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports JSON files from full backup export
                </p>
              </button>
            </div>

            {selectedFile && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Merge (skip duplicates)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Replace all data</span>
                  </label>
                </div>

                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import Data
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              {importResult.success ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">Import completed successfully!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700">Import completed with errors</span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Videos Imported</p>
                <p className="text-lg font-semibold">{importResult.videosImported}</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Videos Skipped</p>
                <p className="text-lg font-semibold">{importResult.videosSkipped}</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Transcripts Imported</p>
                <p className="text-lg font-semibold">{importResult.transcriptsImported}</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Transcripts Skipped</p>
                <p className="text-lg font-semibold">{importResult.transcriptsSkipped}</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Categories</p>
                <p className="text-lg font-semibold">{importResult.categoriesImported} imported, {importResult.categoriesMerged} merged</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-500">Tags</p>
                <p className="text-lg font-semibold">{importResult.tagsImported} imported, {importResult.tagsMerged} merged</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
                <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setImportResult(null);
                setSelectedFile(null);
              }}
              className="mt-4 w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
