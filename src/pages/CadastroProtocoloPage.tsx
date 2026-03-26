import ManualProtocolForm from "@/components/import/ManualProtocolForm";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CadastroProtocoloPage() {
  const navigate = useNavigate();
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
          <h2 className="text-2xl font-bold text-foreground">Cadastrar Protocolo</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre um novo protocolo manualmente
        </p>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 md:p-6">
        <ManualProtocolForm />
      </div>
    </div>
  );
}
