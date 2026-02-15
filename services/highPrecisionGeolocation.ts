import React from 'react';
import { GeolocationService, UserLocation } from './geolocationService';

interface HighPrecisionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  forceHighAccuracy?: boolean;
}

interface LocationAccuracy {
  accuracy: number;
  level: 'high' | 'medium' | 'low';
  description: string;
}

export class HighPrecisionGeolocationService extends GeolocationService {
  private static readonly ACCURACY_LEVELS: LocationAccuracy[] = [
    { accuracy: 10, level: 'high', description: 'GPS Alta Precisão (≤10m)' },
    { accuracy: 50, level: 'medium', description: 'GPS Média Precisão (≤50m)' },
    { accuracy: 100, level: 'low', description: 'GPS Baixa Precisão (≤100m)' }
  ];

  /**
   * Obtém localização padrão (São Paulo)
   */
  static getDefaultLocation(): UserLocation {
    return {
      latitude: -23.5505,
      longitude: -46.6333
    };
  }

  /**
   * Inicia monitoramento de alta precisão
   */
  static startHighPrecisionWatching(
    callback: (location: UserLocation | null) => void,
    options?: HighPrecisionOptions
  ): () => void {
    const watchOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options
    };

    if (!navigator.geolocation) {
      callback(this.getDefaultLocation());
      return () => {};
    }

    // Verificar se está em contexto seguro (HTTPS ou localhost)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      if (import.meta.env.DEV) {
        console.warn('Geolocation requires HTTPS in production. Using fallback location.');
      }
      callback(this.getDefaultLocation());
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        callback(location);
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.warn('High precision watching error:', error);
        }
        
        // Se for erro de segurança, usar fallback
        if (error.code === 1) { // PERMISSION_DENIED
          callback(this.getDefaultLocation());
        } else {
          callback(null);
        }
      },
      watchOptions
    );

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }

  /**
   * Obtém localização com alta precisão forçada
   * Ideal para zona rural ou áreas com sinal GPS fraco
   */
  static async getHighPrecisionLocation(options?: HighPrecisionOptions): Promise<UserLocation> {
    const highPrecisionOptions: HighPrecisionOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // 15 segundos para zona rural
      maximumAge: 0, // Sem cache - sempre posição atual
      forceHighAccuracy: true,
      ...options
    };

    try {
      // Primeira tentativa: Alta precisão
      const location = await this.getCurrentLocation(highPrecisionOptions);
      
      // Verificar se a precisão é suficiente
      if (location.accuracy && location.accuracy <= 50) {
        return location;
      }

      // Segunda tentativa: Extrema precisão (para zona rural)
      const extremePrecisionOptions: HighPrecisionOptions = {
        ...highPrecisionOptions,
        timeout: 20000, // 20 segundos
        enableHighAccuracy: true
      };

      const extremeLocation = await this.getCurrentLocation(extremePrecisionOptions);
      
      if (extremeLocation.accuracy && extremeLocation.accuracy <= 100) {
        return extremeLocation;
      }

      // Se ainda não for suficiente, usar a melhor obtida
      const bestLocation = extremeLocation.accuracy < location.accuracy ? extremeLocation : location;
      
      return bestLocation;

    } catch (error) {
      // Fallback: Usar IP Geolocation (último recurso)
      return this.getIPLocation();
    }
  }

  /**
   * Obtém localização baseada em IP (fallback)
   */
  static async getIPLocation(): Promise<UserLocation> {
    try {
      // Usar serviço de IP Geolocation
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const location: UserLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 1000, // Baixa precisão para IP
          timestamp: Date.now()
        };
        return location;
      }
      
      throw new Error('Não foi possível obter localização por IP');
      
    } catch (error) {
      // Fallback final: Localização padrão (São Paulo)
      return this.getDefaultLocation();
    }
  }

  /**
   * Analisa a qualidade da localização
   */
  static analyzeLocationQuality(location: UserLocation): {
    accuracy: LocationAccuracy;
    isReliable: boolean;
    recommendations: string[];
  } {
    const accuracy = location.accuracy || 1000;
    
    let accuracyLevel: LocationAccuracy;
    if (accuracy <= 10) {
      accuracyLevel = this.ACCURACY_LEVELS[0]; // high
    } else if (accuracy <= 50) {
      accuracyLevel = this.ACCURACY_LEVELS[1]; // medium
    } else {
      accuracyLevel = this.ACCURACY_LEVELS[2]; // low
    }

    const isReliable = accuracy <= 100; // Consideramos confiável até 100m
    const recommendations: string[] = [];

    if (accuracy > 100) {
      recommendations.push('Vá para uma área com céu aberto para melhorar o GPS');
      recommendations.push('Verifique se o GPS do celular está ativado');
    }
    
    if (accuracy > 50) {
      recommendations.push('Aguarde alguns segundos para o GPS estabilizar');
    }

    return {
      accuracy: accuracyLevel,
      isReliable,
      recommendations
    };
  }

  /**
   * Verifica se o usuário está em área rural (baseado na precisão)
   */
  static isLikelyRuralArea(location: UserLocation): boolean {
    const accuracy = location.accuracy || 0;
    return accuracy > 100; // Baixa precisão geralmente indica área rural
  }

  /**
   * Obtém informações detalhadas da localização
   */
  static async getDetailedLocationInfo(location: UserLocation): Promise<{
    location: UserLocation;
    quality: ReturnType<typeof this.analyzeLocationQuality>;
    isRural: boolean;
    address?: any;
  }> {
    const quality = this.analyzeLocationQuality(location);
    const isRural = this.isLikelyRuralArea(location);
    
    let address;
    try {
      address = await this.reverseGeocode(location.latitude, location.longitude);
    } catch (error) {
      // silent
    }

    return {
      location,
      quality,
      isRural,
      address
    };
  }

  /**
   * Corrige drift de GPS (comum em áreas rurais)
   */
  static correctGPSDrift(locations: UserLocation[]): UserLocation {
    if (locations.length < 3) {
      return locations[locations.length - 1]; // Retorna a última se tiver poucos pontos
    }

    // Filtra outliers (pontos muito distantes)
    const validLocations = locations.filter((loc, index) => {
      if (index === 0) return true;
      
      const prevLoc = locations[index - 1];
      const distance = this.calculateDistance(
        prevLoc.latitude, prevLoc.longitude,
        loc.latitude, loc.longitude
      );
      
      // Se a distância for maior que 200m, provavelmente é um outlier
      return distance <= 0.2; // 200m
    });

    // Calcula média das últimas localizações válidas
    const recentLocations = validLocations.slice(-3); // Últimas 3 localizações
    
    const avgLatitude = recentLocations.reduce((sum, loc) => sum + loc.latitude, 0) / recentLocations.length;
    const avgLongitude = recentLocations.reduce((sum, loc) => sum + loc.longitude, 0) / recentLocations.length;
    const avgAccuracy = recentLocations.reduce((sum, loc) => sum + (loc.accuracy || 0), 0) / recentLocations.length;

    return {
      latitude: avgLatitude,
      longitude: avgLongitude,
      accuracy: avgAccuracy,
      timestamp: Date.now()
    };
  }

  /**
   * Hook React para localização de alta precisão
   */
  static useHighPrecisionGeolocation(options?: HighPrecisionOptions) {
    const [location, setLocation] = React.useState<UserLocation | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [quality, setQuality] = React.useState<ReturnType<typeof HighPrecisionGeolocationService.analyzeLocationQuality> | null>(null);
    const [isRural, setIsRural] = React.useState(false);

    // Memoizar options para evitar re-renderização infinita
    const memoizedOptions = React.useMemo(() => ({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      forceHighAccuracy: true,
      ...options
    }), [options?.enableHighAccuracy, options?.timeout, options?.maximumAge, options?.forceHighAccuracy]);

    React.useEffect(() => {
      let mounted = true;
      let stopWatching: (() => void) | null = null;

      const getLocation = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const loc = await HighPrecisionGeolocationService.getHighPrecisionLocation(memoizedOptions);
          if (mounted) {
            setLocation(loc);
            setQuality(HighPrecisionGeolocationService.analyzeLocationQuality(loc));
            setIsRural(HighPrecisionGeolocationService.isLikelyRuralArea(loc));
            setError(null);
          }
        } catch (err) {
          if (mounted) {
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
            setError(errorMessage);
            
            // Usar localização padrão como fallback
            const defaultLoc = HighPrecisionGeolocationService.getDefaultLocation();
            setLocation(defaultLoc);
            setQuality(HighPrecisionGeolocationService.analyzeLocationQuality(defaultLoc));
            setIsRural(HighPrecisionGeolocationService.isLikelyRuralArea(defaultLoc));
            setError(null);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      // Obter localização inicial
      getLocation();

      // Iniciar monitoramento contínuo
      if (memoizedOptions?.forceHighAccuracy !== false) {
        stopWatching = HighPrecisionGeolocationService.startHighPrecisionWatching((loc) => {
          if (mounted && loc) {
            setLocation(loc);
            setQuality(HighPrecisionGeolocationService.analyzeLocationQuality(loc));
            setIsRural(HighPrecisionGeolocationService.isLikelyRuralArea(loc));
            setError(null);
          }
        }, memoizedOptions);
      }

      return () => {
        mounted = false;
        if (stopWatching) {
          stopWatching();
        }
      };
    }, [memoizedOptions]);

    // Memoizar refreshLocation para evitar re-renderização infinita
    const refreshLocation = React.useCallback(() => {
      return HighPrecisionGeolocationService.getHighPrecisionLocation(memoizedOptions).then(setLocation);
    }, [memoizedOptions]);

    return { 
      location, 
      error, 
      loading, 
      quality, 
      isRural,
      refreshLocation
    };
  }
}

// Exportar o hook separadamente
export const useHighPrecisionGeolocation = HighPrecisionGeolocationService.useHighPrecisionGeolocation;
