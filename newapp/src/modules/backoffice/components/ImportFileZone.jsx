import { Upload, FileText } from 'lucide-react';

export default function ImportFileZone({ files, dragOver, inputRef, onFiles, setDragOver }) {
  return (
    <>
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
      >
        <Upload size={32} className="mx-auto mb-2 text-slate-300" />
        {files.length === 0 ? (
          <p className="text-sm text-slate-400">Cliquer ou glisser-déposer les fichiers ici</p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-medium">
                <FileText size={12} className="text-indigo-400" /> {f.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept=".csv,.zip" className="hidden" onChange={(e) => onFiles(e.target.files)} />
    </>
  );
}
