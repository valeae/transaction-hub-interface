import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Tipos para Extended JSON de MongoDB
interface MongoExtendedJSON {
  $oid?: string;
  $date?: string;
  $numberLong?: string;
  $numberInt?: number;
  $numberDouble?: number;
  $binary?: string;
  $regex?: string;
  $timestamp?: string;
  $undefined?: boolean;
  $minKey?: boolean;
  $maxKey?: boolean;
  $ref?: string;
  $id?: string;
  $db?: string;
}

const TransactionForm = () => {
  const [transactionId, setTransactionId] = useState<string>('');
  const [transactionData, setTransactionData] = useState<string>('{}');
  const [webcheckoutData, setWebcheckoutData] = useState<string>('{}');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const { toast } = useToast();

  const WEBHOOK_URL = 'https://n8n-heroku-backup-2ed39cd10b25.herokuapp.com/webhook/bdb7f3d6-b8b1-410a-9558-810b51320f0f';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transaction = urlParams.get('transaction');
    if (!transaction) {
      setError('Falta el parámetro "transaction" en la URL');
      return;
    }
    setTransactionId(transaction);
  }, []);

  // Función para convertir Extended JSON de MongoDB a JSON estándar
  const parseMongoExtendedJSON = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Si es un array, procesar cada elemento
    if (Array.isArray(obj)) {
      return obj.map(item => parseMongoExtendedJSON(item));
    }

    // Si es un objeto, procesar sus propiedades
    if (typeof obj === 'object') {
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          // Procesar tipos especiales de MongoDB
          if ('$oid' in value && typeof value.$oid === 'string') {
            result[key] = value.$oid; // Convertir ObjectId a string
          } else if ('$date' in value && typeof value.$date === 'string') {
            result[key] = new Date(value.$date).toISOString(); // Convertir Date a ISO string
          } else if ('$numberLong' in value && typeof value.$numberLong === 'string') {
            result[key] = parseInt(value.$numberLong); // Convertir NumberLong a number
          } else if ('$numberInt' in value && typeof value.$numberInt === 'number') {
            result[key] = value.$numberInt; // Mantener NumberInt como number
          } else if ('$numberDouble' in value && typeof value.$numberDouble === 'string') {
            result[key] = parseFloat(value.$numberDouble); // Convertir NumberDouble a number
          } else if ('$binary' in value && typeof value.$binary === 'string') {
            result[key] = value.$binary; // Mantener Binary como string
          } else if ('$regex' in value && typeof value.$regex === 'string') {
            result[key] = value.$regex; // Mantener Regex como string
          } else if ('$timestamp' in value && typeof value.$timestamp === 'string') {
            result[key] = new Date(parseInt(value.$timestamp)).toISOString(); // Convertir Timestamp
          } else if ('$undefined' in value) {
            result[key] = undefined; // Convertir Undefined
          } else if ('$minKey' in value) {
            result[key] = -Infinity; // Convertir MinKey
          } else if ('$maxKey' in value) {
            result[key] = Infinity; // Convertir MaxKey
          } else if ('$ref' in value && '$id' in value && typeof value.$ref === 'string' && typeof value.$id === 'string') {
            result[key] = { ref: value.$ref, id: value.$id }; // Mantener DBRef
          } else {
            // Si no es un tipo especial, procesar recursivamente
            result[key] = parseMongoExtendedJSON(value);
          }
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }

    return obj;
  };

  // Función para convertir formato de MongoDB Shell a Extended JSON
  const convertMongoShellToExtendedJSON = (text: string): string => {
    // Convertir ObjectId("...") a {"$oid": "..."}
    let converted = text.replace(/ObjectId\("([^"]+)"\)/g, '{"$oid": "$1"}');
    
    // Convertir ISODate("...") a {"$date": "..."}
    converted = converted.replace(/ISODate\("([^"]+)"\)/g, '{"$date": "$1"}');
    
    // Convertir NumberLong("...") a {"$numberLong": "..."}
    converted = converted.replace(/NumberLong\("([^"]+)"\)/g, '{"$numberLong": "$1"}');
    
    // Convertir NumberInt(...) a {"$numberInt": ...}
    converted = converted.replace(/NumberInt\(([^)]+)\)/g, '{"$numberInt": $1}');
    
    // Convertir NumberDouble("...") a {"$numberDouble": "..."}
    converted = converted.replace(/NumberDouble\("([^"]+)"\)/g, '{"$numberDouble": "$1"}');
    
    // Convertir Timestamp(...) a {"$timestamp": "..."}
    converted = converted.replace(/Timestamp\(([^)]+)\)/g, '{"$timestamp": "$1"}');
    
    // Convertir BinData(...) a {"$binary": "..."}
    converted = converted.replace(/BinData\([^,]+,\s*"([^"]+)"\)/g, '{"$binary": "$1"}');
    
    // Convertir RegExp(...) a {"$regex": "..."}
    converted = converted.replace(/RegExp\("([^"]+)"\)/g, '{"$regex": "/$1/"}');
    
    // Convertir undefined a {"$undefined": true}
    converted = converted.replace(/undefined/g, '{"$undefined": true}');
    
    // Convertir MinKey a {"$minKey": 1}
    converted = converted.replace(/MinKey/g, '{"$minKey": 1}');
    
    // Convertir MaxKey a {"$maxKey": 1}
    converted = converted.replace(/MaxKey/g, '{"$maxKey": 1}');
    
    // Convertir DBRef(...) a {"$ref": "...", "$id": "..."}
    converted = converted.replace(/DBRef\("([^"]+)",\s*"([^"]+)"\)/g, '{"$ref": "$1", "$id": "$2"}');
    
    return converted;
  };

  // Función para validar y parsear JSON (estándar, Extended JSON de MongoDB, o MongoDB Shell)
  const validateAndParseJSON = (jsonString: string): { isValid: boolean; parsedData?: any; error?: string } => {
    try {
      // Primero intentar parsear como JSON estándar
      const parsed = JSON.parse(jsonString);
      
      // Si es JSON estándar, verificar si tiene tipos de MongoDB y convertirlos
      const converted = parseMongoExtendedJSON(parsed);
      
      return { isValid: true, parsedData: converted };
    } catch (err) {
      try {
        // Si falla JSON estándar, intentar convertir formato de MongoDB Shell a Extended JSON
        const convertedText = convertMongoShellToExtendedJSON(jsonString);
        
        try {
          const parsed = JSON.parse(convertedText);
          const converted = parseMongoExtendedJSON(parsed);
          return { isValid: true, parsedData: converted };
        } catch (conversionErr) {
          // Si aún falla, intentar con eval (para casos más complejos de MongoDB Shell)
          const parsed = eval('(' + jsonString + ')');
          const converted = parseMongoExtendedJSON(parsed);
          return { isValid: true, parsedData: converted };
        }
      } catch (evalErr) {
        return { 
          isValid: false, 
          error: `Error al parsear JSON. Asegúrate de usar JSON estándar, Extended JSON de MongoDB, o formato de MongoDB Shell. Error: ${err instanceof Error ? err.message : 'Formato inválido'}` 
        };
      }
    }
  };

  // Función para formatear JSON con indentación
  const formatJSON = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return 'Error al formatear JSON';
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

    // Validar y parsear JSON (estándar, Extended JSON de MongoDB, o MongoDB Shell)
    const transactionValidation = validateAndParseJSON(transactionData);
    if (!transactionValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: `Los datos de 'transaction' no son válidos. Asegúrate de usar JSON estándar, Extended JSON de MongoDB, o formato de MongoDB Shell. Error: ${transactionValidation.error}`,
      });
      return;
    }

    const webcheckoutValidation = validateAndParseJSON(webcheckoutData);
    if (!webcheckoutValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: `Los datos de 'webcheckout' no son válidos. Asegúrate de usar JSON estándar, Extended JSON de MongoDB, o formato de MongoDB Shell. Error: ${webcheckoutValidation.error}`,
      });
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const parsedTransaction = transactionValidation.parsedData;
      const parsedWebcheckout = webcheckoutValidation.parsedData;
      
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
      
      toast({
        title: "Actualización exitosa",
        description: `Los datos se han actualizado correctamente para la transacción ${transactionId}.`,
        className: "bg-primary text-white border border-border",
      });

      // Construir URL de Insight Viewer y habilitar el botón de redirección
      const insightViewerUrl = `https://epayco-insight-viewer.lovable.app/?transaction=${transactionId}`;
      setRedirectUrl(insightViewerUrl);
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

  // Función para formatear automáticamente el Extended JSON
  const formatExtendedJSON = (field: 'transaction' | 'webcheckout') => {
    const data = field === 'transaction' ? transactionData : webcheckoutData;
    const validation = validateAndParseJSON(data);
    
    if (validation.isValid && validation.parsedData) {
      const formatted = formatJSON(validation.parsedData);
      if (field === 'transaction') {
        setTransactionData(formatted);
      } else {
        setWebcheckoutData(formatted);
      }
      
      toast({
        title: "JSON formateado",
        description: "JSON convertido y formateado correctamente.",
        className: "bg-green-500 text-white border border-green-600",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error de formato",
        description: `No se pudo formatear el ${field}: ${validation.error}`,
      });
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

          {redirectUrl && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-segoe-bold text-blue-900">¡Datos actualizados exitosamente!</p>
                  <p className="font-segoe text-sm text-blue-700 mt-1">
                    Ver detalles de la transacción en Insight Viewer
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = redirectUrl)}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100 font-segoe-bold"
                >
                  Ver en Insight Viewer
                </Button>
              </div>
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
                Datos de Transacción (JSON/MongoDB)
              </Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => formatExtendedJSON('transaction')}
                  className="text-xs"
                >
                  Formatear
                </Button>
                <span className="text-xs text-muted-foreground">
                  Soporta JSON estándar, ObjectId("..."), ISODate("..."), NumberLong("..."), etc.
                </span>
              </div>
              <Textarea
                id="transaction"
                value={transactionData}
                onChange={(e) => setTransactionData(e.target.value)}
                placeholder="Pega aquí JSON estándar, Extended JSON de MongoDB, o output de MongoDB Shell..."
                className="min-h-[200px] font-mono text-sm rounded-lg border-2 border-primary/30 focus:border-primary/70 shadow-sm"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="webcheckout" className="font-segoe-bold">
                Datos de Webcheckout (JSON/MongoDB)
              </Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => formatExtendedJSON('webcheckout')}
                  className="text-xs"
                >
                  Formatear
                </Button>
                <span className="text-xs text-muted-foreground">
                  Soporta JSON estándar, ObjectId("..."), ISODate("..."), NumberLong("..."), etc.
                </span>
              </div>
              <Textarea
                id="webcheckout"
                value={webcheckoutData}
                onChange={(e) => setWebcheckoutData(e.target.value)}
                placeholder="Pega aquí JSON estándar, Extended JSON de MongoDB, o output de MongoDB Shell..."
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
                  const transactionValidation = validateAndParseJSON(transactionData);
                  const webcheckoutValidation = validateAndParseJSON(webcheckoutData);
                  
                  if (transactionValidation.isValid && webcheckoutValidation.isValid) {
                    preview = {
                      transactionId,
                      transaction: transactionValidation.parsedData,
                      webcheckout: webcheckoutValidation.parsedData,
                    };
                  } else {
                    preview = { 
                      error: 'JSON inválido en alguno de los campos.',
                      transactionError: transactionValidation.error,
                      webcheckoutError: webcheckoutValidation.error
                    };
                  }
                } catch {
                  preview = { error: 'Error al procesar JSON.' };
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