import React, { useRef } from 'react';
import { Upload, FileText, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

interface CSVImporterProps {
  onDataLoaded: (data: any) => void;
  label?: string;
  className?: string;
}

export default function CSVImporter({ onDataLoaded, label, className }: CSVImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    Papa.parse(file, {
      complete: (results) => {
        setIsUploading(false);
        if (results.errors.length > 0) {
          // If it's just a delimiter issue, skip reporting error here and handle in processing
          console.warn("PapaParse errors:", results.errors);
        }
        
        if (!results.data || results.data.length === 0) {
          setError("El archivo está vacío.");
          return;
        }

        // Success!
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        onDataLoaded(results.data);
      },
      header: false,
      skipEmptyLines: 'greedy',
      encoding: "UTF-8",
      transform: (value) => value.trim()
    });
  };

  return (
    <div className="relative inline-block">
      <input 
        type="file" 
        accept=".csv" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={className || `
          flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all
          ${isUploading ? 'bg-outline-variant text-light-coffee cursor-wait' : 'bg-secondary text-white shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-[0.98]'}
        `}
      >
        {isUploading ? (
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Upload size={18} />
          </motion.div>
        ) : (
          <FileText size={18} />
        )}
        <span>{isUploading ? 'Procesando...' : (label || 'Cargar Base (CSV)')}</span>
      </button>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-full mt-2 left-0 right-0 bg-green-500 text-white text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 z-50"
          >
            <Check size={14} />
            <span>Base cargada exitosamente</span>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-full mt-2 left-0 right-0 bg-red-500 text-white text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 z-50"
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
