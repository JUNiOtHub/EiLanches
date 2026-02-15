import { useState, useEffect, useCallback } from 'react';
import { GeolocationService, UserLocation } from '../services/geolocationService';

interface UseGeolocationReturn {
  location: UserLocation | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

export const useGeolocation = (options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): UseGeolocationReturn => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const loc = await GeolocationService.getCurrentLocation(options);
      setLocation(loc);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter localização';
      setError(errorMessage);
      
      // Usar localização padrão como fallback
      setLocation(GeolocationService.getDefaultLocation());
    } finally {
      setLoading(false);
    }
  }, [options]);

  const refreshLocation = useCallback(async () => {
    await requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    let mounted = true;

    const initializeLocation = async () => {
      try {
        setLoading(true);
        
        // Verificar se geolocalização é suportada
        if (!GeolocationService.isSupported()) {
          throw new Error('Geolocalização não suportada pelo navegador');
        }

        // Tentar obter localização atual
        const loc = await GeolocationService.getCurrentLocation(options);
        
        if (mounted) {
          setLocation(loc);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
          setError(errorMessage);
          
          // Usar localização padrão como fallback
          setLocation(GeolocationService.getDefaultLocation());
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeLocation();

    return () => {
      mounted = false;
    };
  }, [options?.enableHighAccuracy, options?.timeout, options?.maximumAge]);

  return {
    location,
    error,
    loading,
    requestLocation,
    refreshLocation
  };
};
