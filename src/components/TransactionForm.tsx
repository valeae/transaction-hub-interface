import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface TransactionData {
  transactionId: string;
  transaction: any;
  webcheckout: any;
}

const TransactionForm = () => {
  const [transactionId, setTransactionId] = useState<string>('');
  const [fullData, setFullData] = useState<TransactionData | null>(null);
  const [transactionFields, setTransactionFields] = useState<Record<string, any>>({});
  const [webcheckoutFields, setWebcheckoutFields] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const WEBHOOK_URL = 'https://n8n-heroku-backup-2ed39cd10b25.herokuapp.com/webhook/c600a845-e746-46f9-9d2d-e36bffe10953';

  // Función para extraer campos planos (solo string, number, boolean)
  const extractFlatFields = (obj: any): Record<string, any> => {
    const flatFields: Record<string, any> = {};
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          flatFields[key] = value;
        }
      });
    }
    return flatFields;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionParam = urlParams.get('transactionId');

    if (!transactionParam) {
      setError('Falta el parámetro "transactionId" en la URL');
      return;
    }

    setTransactionId(transactionParam);
    fetchTransactionData(transactionParam);
  }, []);

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
      
      setFullData(data);
      setTransactionFields(extractFlatFields(data.transaction));
      setWebcheckoutFields(extractFlatFields(data.webcheckout));
      
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

  const handleFieldChange = (section: 'transaction' | 'webcheckout', field: string, value: any) => {
    if (section === 'transaction') {
      setTransactionFields(prev => ({ ...prev, [field]: value }));
    } else {
      setWebcheckoutFields(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleUpdate = async () => {
    if (!transactionId || transactionId.trim() === '') {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "No se ha proporcionado un ID de transacción válido.",
      });
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Reconstruir objetos completos manteniendo campos no planos originales
      const updatedTransaction = { ...fullData?.transaction };
      Object.keys(transactionFields).forEach(key => {
        updatedTransaction[key] = transactionFields[key];
      });

      const updatedWebcheckout = { ...fullData?.webcheckout };
      Object.keys(webcheckoutFields).forEach(key => {
        updatedWebcheckout[key] = webcheckoutFields[key];
      });

      const payload = {
        transactionId,
        transaction: updatedTransaction,
        webcheckout: updatedWebcheckout
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
      
      toast({
        title: "Actualización exitosa",
        description: `Los datos se han actualizado correctamente para la transacción ${transactionId}.`,
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

  const renderFieldInputs = (fields: Record<string, any>, section: 'transaction' | 'webcheckout') => {
    return Object.keys(fields).map(key => {
      const value = fields[key];
      const inputType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text';
      
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={`${section}-${key}`} className="font-segoe-bold">
            {key}
          </Label>
          {typeof value === 'boolean' ? (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`${section}-${key}`}
                checked={value}
                onChange={(e) => handleFieldChange(section, key, e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor={`${section}-${key}`} className="font-segoe">
                {value ? 'Verdadero' : 'Falso'}
              </Label>
            </div>
          ) : (
            <Input
              id={`${section}-${key}`}
              type={inputType}
              value={value}
              onChange={(e) => {
                const newValue = inputType === 'number' ? Number(e.target.value) : e.target.value;
                handleFieldChange(section, key, newValue);
              }}
              className="font-segoe"
            />
          )}
        </div>
      );
    });
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

  if (loading && !fullData) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card className="border-primary">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="font-segoe-semibold text-xl">
              Cargando Información de Transacción...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-6">
      {/* Campos editables */}
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
          
          {/* Transaction ID */}
          <div className="space-y-2">
            <Label htmlFor="transactionId" className="font-segoe-bold">
              ID de Transacción
            </Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="font-segoe-bold"
            />
          </div>

          {/* Transaction Fields */}
          {Object.keys(transactionFields).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-segoe-semibold text-lg text-primary">Campos de Transaction</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFieldInputs(transactionFields, 'transaction')}
              </div>
            </div>
          )}

          {/* Webcheckout Fields */}
          {Object.keys(webcheckoutFields).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-segoe-semibold text-lg text-primary">Campos de Webcheckout</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFieldInputs(webcheckoutFields, 'webcheckout')}
              </div>
            </div>
          )}
          
          <Button
            onClick={handleUpdate}
            disabled={loading || !transactionId}
            className="w-full font-segoe-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {loading ? 'Actualizando...' : 'Actualizar información'}
          </Button>
        </CardContent>
      </Card>

      {/* JSON Viewer */}
      {fullData && (
        <Card className="border-muted">
          <CardHeader className="bg-muted">
            <CardTitle className="font-segoe-semibold text-xl">
              Visualizador JSON (Solo lectura)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <pre className="bg-muted/50 p-4 rounded-md overflow-auto text-sm font-mono max-h-96">
              {JSON.stringify(fullData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransactionForm;