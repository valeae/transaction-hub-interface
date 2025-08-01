import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface TransactionData {
  transactionId: string;
  transaction: any;
  webcheckout: any;
}

const TransactionForm = () => {
  const [transactionId, setTransactionId] = useState<string>('');
  const [transactionData, setTransactionData] = useState<string>('{}');
  const [webcheckoutData, setWebcheckoutData] = useState<string>('{}');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const WEBHOOK_URL = 'https://n8n-heroku-backup-2ed39cd10b25.herokuapp.com/webhook/c600a845-e746-46f9-9d2d-e36bffe10953';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transaction = urlParams.get('transaction');
    if (!transaction) {
      setError('Falta el parámetro "transaction" en la URL');
      return;
    }
    setTransactionId(transaction);
    fetchTransactionData(transaction);
  }, []);

  // Nueva función para enviar el POST al webhook con el parámetro transaction
  const sendTransactionToWebhook = async (transaction: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${WEBHOOK_URL}?transaction=${transaction}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Puedes enviar un body vacío o ajustarlo según lo que requiera el webhook
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error ${response.status}: ${errorData}`);
      }
      toast({
        title: 'Transacción enviada',
        description: 'Se envió el parámetro transaction al webhook correctamente.',
      });
    } catch (err) {
      setError('Error al enviar la transacción al webhook.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionData = async (id: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${WEBHOOK_URL}?_id=${id}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener los datos');
      }
      
      const data: TransactionData = await response.json();
      
      if (!data.transaction && !data.webcheckout) {
        setError('No se encontraron datos para esta transacción.');
        return;
      }
      
      setTransactionData(JSON.stringify(data.transaction || {}, null, 2));
      setWebcheckoutData(JSON.stringify(data.webcheckout || {}, null, 2));
      
      toast({
        title: "Datos cargados",
        description: "Se han cargado los datos de la transacción correctamente.",
      });
      
    } catch (err) {
      setError('Error al cargar los datos de la transacción.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateJSON = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  const handleUpdate = async () => {
    // Validación de ID de transacción
    if (!transactionId || transactionId.trim() === '') {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "No se ha proporcionado un ID de transacción válido.",
      });
      return;
    }

    // Validación de JSON
    if (!validateJSON(transactionData)) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "Los datos de 'transaction' no son un JSON válido.",
      });
      return;
    }
    
    if (!validateJSON(webcheckoutData)) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "Los datos de 'webcheckout' no son un JSON válido.",
      });
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const parsedTransaction = JSON.parse(transactionData);
      const parsedWebcheckout = JSON.parse(webcheckoutData);
      
      // Validación de que el ID coincida con la inserción
      if (parsedTransaction.id && parsedTransaction.id !== transactionId) {
        toast({
          variant: "destructive",
          title: "Error de consistencia",
          description: `El ID en los datos de transacción (${parsedTransaction.id}) no coincide con el ID de la URL (${transactionId}).`,
        });
        setLoading(false);
        return;
      }
      
      if (parsedWebcheckout.transaction_id && parsedWebcheckout.transaction_id !== transactionId) {
        toast({
          variant: "destructive",
          title: "Error de consistencia",
          description: `El transaction_id en webcheckout (${parsedWebcheckout.transaction_id}) no coincide con el ID de la URL (${transactionId}).`,
        });
        setLoading(false);
        return;
      }
      
      const payload = {
        transactionId,
        transaction: parsedTransaction,
        webcheckout: parsedWebcheckout
      };
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error ${response.status}: ${errorData}`);
      }
      
      const responseData = await response.json();
      
      toast({
        title: "Actualización exitosa",
        description: `Los datos se han actualizado correctamente para la transacción ${transactionId}.`,
        className: "bg-primary text-white border border-border",
      });
      
      // Refrescar datos después de actualización exitosa
      setTimeout(() => {
        fetchTransactionData(transactionId);
      }, 1000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al actualizar: ${errorMessage}`);
      
      toast({
        variant: "destructive",
        title: "Error de actualización",
        description: `No se pudieron actualizar los datos: ${errorMessage}`,
      });
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (error && !transactionId) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center font-segoe-bold">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <Card className="border-primary">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle className="font-segoe-semibold text-xl">
            Información de Transacción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
              <p className="font-segoe">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="transactionId" className="font-segoe-bold">
              ID de Transacción
            </Label>
            <Input
              id="transactionId"
              value={transactionId}
              readOnly
              className="bg-muted font-segoe-bold rounded-lg border-2 border-primary/30 focus:border-primary/70 shadow-sm"
            />
          </div>

          {/* Dos columnas para los JSON */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="transaction" className="font-segoe-bold">
                Datos de Transacción
              </Label>
              <Textarea
                id="transaction"
                value={transactionData}
                onChange={(e) => setTransactionData(e.target.value)}
                placeholder="Datos de la transacción en formato JSON..."
                className="min-h-[200px] font-mono text-sm rounded-lg border-2 border-primary/30 focus:border-primary/70 shadow-sm"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="webcheckout" className="font-segoe-bold">
                Datos de Webcheckout
              </Label>
              <Textarea
                id="webcheckout"
                value={webcheckoutData}
                onChange={(e) => setWebcheckoutData(e.target.value)}
                placeholder="Datos del webcheckout en formato JSON..."
                className="min-h-[200px] font-mono text-sm rounded-lg border-2 border-primary/30 focus:border-primary/70 shadow-sm"
              />
            </div>
          </div>

          {/* Botón de previsualización */}
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              className="bg-primary text-white border border-border font-segoe-bold rounded-md px-4 py-2 hover:bg-primary/90 transition-colors duration-200"
              onClick={() => setShowPreview((prev) => !prev)}
            >
              {showPreview ? 'Ocultar previsualización' : 'Previsualizar JSON a enviar'}
            </Button>
          </div>

          {/* Previsualización del JSON */}
          {showPreview && (
            <div className="bg-muted border border-primary/30 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap break-all">
              {(() => {
                let preview = {};
                try {
                  preview = {
                    transactionId,
                    transaction: JSON.parse(transactionData),
                    webcheckout: JSON.parse(webcheckoutData),
                  };
                } catch {
                  preview = { error: 'JSON inválido en alguno de los campos.' };
                }
                return <pre>{JSON.stringify(preview, null, 2)}</pre>;
              })()}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleUpdate}
              disabled={loading || !transactionId}
              className="w-50 font-segoe-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionForm;