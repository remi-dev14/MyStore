import { useState, useRef } from 'react';
import { api } from '../../../config/api.js';
import { parseCsvText, detectFileType } from '../../../utils/csvParser.js';
import { validateCsv } from '../../../utils/importValidation.js';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { Upload } from 'lucide-react';
import ImportFileZone from './ImportFileZone.jsx';
import ImportPreviewList from './ImportPreviewList.jsx';
import ImportResult from './ImportResult.jsx';

export default function ImportPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [importImageEnable, setimportImagesEnable ] = useState(true) ;

  async function handleFiles(selected) {
    const fileList = Array.from(selected);
    setFiles(fileList);
    setResult(null);
    const previews = [];
    for (const file of fileList) {
      if (file.name.endsWith('.zip')) {
        previews.push({ file: file.name, type: 'zip', columns: [], rows: [], errors: [], total: 0 });
        continue;
      }
      try {
        const text = await file.text();
        const rows = parseCsvText(text);
        const columns = rows.length ? Object.keys(rows[0]) : [];
        const type = detectFileType(columns);
        const errors = validateCsv(rows, type);
        previews.push({ file: file.name, type, columns, rows: rows.slice(0, 5), errors, total: rows.length });
      } catch (e) {
        previews.push({ file: file.name, type: 'error', columns: [], rows: [], errors: [{ row: 0, column: '-', message: e.message }], total: 0 });
      }
    }
    setPreview(previews);
  }

  const hasErrors = preview.some((p) => p.errors.length > 0);

  async function handleImport() {
    if (!files.length || hasErrors) return;
    setLoading(true);
    setProgress(10);
    setResult(null);
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('importImages', importImageEnable ? '1' : '0');

    try {
      setProgress(50);
      const res = await api.post('/api/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProgress(100);
      setResult(res.data);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error ?? err.message, log: [], errors: [] });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Import des données</h1>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          className="w-4 h-4 accent-indigo-500"
          checked={importImageEnable}
          onChange={(e) => setimportImagesEnable(e.target.checked)}
        />
        Importer les images (images.zip)
      </label>
      
      <Card>
        <CardTitle className="mb-1 flex items-center gap-2">
          <Upload size={16} className="text-indigo-500" /> Sélection des fichiers
        </CardTitle>
        <p className="text-xs text-slate-400 mb-4">
          Fichiers attendus : <code className="bg-slate-100 px-1 rounded">fichier1.csv</code>, <code className="bg-slate-100 px-1 rounded">fichier2.csv</code>, <code className="bg-slate-100 px-1 rounded">fichier3.csv</code>, <code className="bg-slate-100 px-1 rounded">images.zip</code>
        </p>

        <ImportFileZone files={files} dragOver={dragOver} inputRef={inputRef} onFiles={handleFiles} setDragOver={setDragOver} />
        <ImportPreviewList preview={preview} hasErrors={hasErrors} />

        <div className="mt-5 flex items-center gap-4">
          <Button onClick={handleImport} disabled={loading || files.length === 0 || hasErrors}>
            <Upload size={15} /> {loading ? 'Import en cours…' : 'Importer'}
          </Button>
          {files.length > 0 && (
            <button onClick={() => { setFiles([]); setPreview([]); setResult(null); }} className="text-sm text-slate-400 hover:text-slate-600">
              Effacer
            </button>
          )}
        </div>

        {loading && (
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </Card>

      {result && (
        <Card>
          <ImportResult result={result} />
        </Card>
      )}
    </div>
  );
}
