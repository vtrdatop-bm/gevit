import ManualProtocolForm from "@/components/import/ManualProtocolForm";

export default function CadastroProtocoloPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Cadastrar Protocolo</h2>
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
