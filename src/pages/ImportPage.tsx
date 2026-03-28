import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, validateCNPJ } from "@/lib/utils";

interface ImportRow {
  numero: string;
  data_solicitacao: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  bairro: string;
  municipio: string;
  area: string;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f); setErrors([]); setImported(false); setProcessing(true);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext === "csv") {
        const Papa = await import("papaparse");
        const text = await f.text();
        processRows(Papa.default.parse<ImportRow>(text, { header: true, skipEmptyLines: true }).data);
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        processRows(XLSX.utils.sheet_to_json<ImportRow>(wb.Sheets[wb.SheetNames[0]]));
      } else {
        setErrors(["Formato não suportado. Use CSV ou Excel (.xlsx/.xls)"]);
      }
    } catch { setErrors(["Erro ao processar arquivo"]); }
    finally { setProcessing(false); }
  };

  const processRows = (data: ImportRow[]) => {
    const errs: string[] = [];
    const seen = new Set<string>();
    data.forEach((row, i) => {
      if (!row.numero) errs.push(`Linha ${i + 2}: protocolo vazio`);
      if (seen.has(row.numero)) errs.push(`Linha ${i + 2}: protocolo duplicado (${row.numero})`);
      seen.add(row.numero);
      if (row.cnpj && !validateCNPJ(row.cnpj)) errs.push(`Linha ${i + 2}: CNPJ inválido (${row.cnpj})`);
    });
    setRows(data); setErrors(errs);
  };

  const handleImport = () => {
    setProcessing(true);
    setTimeout(() => { setImported(true); setProcessing(false); }, 1500);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground">Importar Protocolos</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Faça upload de arquivo CSV ou Excel com os dados dos protocolos</p>
      </div>

      <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={cn("border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors",
          file ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-accent/50")}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {file ? (
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{rows.length} registros encontrados</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); setRows([]); setErrors([]); setImported(false); }}
              className="p-1 rounded hover:bg-accent"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Arraste o arquivo ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">CSV ou Excel (.xlsx, .xls)</p>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
            <AlertCircle className="w-4 h-4" />{errors.length} problema(s) encontrado(s)
          </div>
          {errors.slice(0, 10).map((err, i) => <p key={i} className="text-xs text-muted-foreground">{err}</p>)}
          {errors.length > 10 && <p className="text-xs text-muted-foreground">...e mais {errors.length - 10}</p>}
        </div>
      )}

      {rows.length > 0 && !imported && (
        <div className="bg-card rounded-xl border border-border p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Pré-visualização ({rows.length} registros)</h3>
            <button onClick={handleImport} disabled={errors.length > 0 || processing}
              className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                errors.length > 0 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {processing ? "Importando..." : "Importar Protocolos"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border">
                {["Protocolo", "CNPJ", "Razão Social", "Fantasia", "Bairro", "Município"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2 px-3 font-mono">{row.numero}</td>
                    <td className="py-2 px-3">{row.cnpj}</td>
                    <td className="py-2 px-3">{row.razao_social}</td>
                    <td className="py-2 px-3">{row.nome_fantasia}</td>
                    <td className="py-2 px-3">{row.bairro}</td>
                    <td className="py-2 px-3">{row.municipio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {imported && (
        <div className="bg-[hsl(var(--status-certified)/0.1)] border border-[hsl(var(--status-certified)/0.2)] rounded-lg p-6 flex items-center gap-4 animate-fade-in">
          <CheckCircle2 className="w-8 h-8 text-[hsl(var(--status-certified))]" />
          <div>
            <p className="text-sm font-semibold text-foreground">{rows.length} protocolos importados com sucesso!</p>
            <p className="text-xs text-muted-foreground mt-1">Processos criados e geocodificação em andamento</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Colunas esperadas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["numero", "data_solicitacao", "cnpj", "razao_social", "nome_fantasia", "endereco", "bairro", "municipio", "area"].map((col) => (
            <span key={col} className="text-xs font-mono bg-accent px-2 py-1 rounded text-muted-foreground">{col}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
