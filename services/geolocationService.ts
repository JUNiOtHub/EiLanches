import React from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export class GeolocationService {
  private static watchId: number | null = null;
  private static callbacks: Set<(location: UserLocation | null) => void> = new Set();

  /**
   * Obtém a localização atual do usuário
   */
  static async getCurrentLocation(options?: GeolocationOptions): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      // Verificar se está em contexto seguro (HTTPS ou localhost)
      if (typeof location !== 'undefined' && 
          location.protocol !== 'https:' && 
          location.hostname !== 'localhost' && 
          location.hostname !== '127.0.0.1') {
        if (import.meta.env.DEV) {
          console.warn('Geolocation requires HTTPS in production. Using fallback location.');
        }
        resolve(this.getDefaultLocation());
        return;
      }

      const defaultOptions: GeolocationOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutos
        ...options
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          resolve(location);
        },
        (error) => {
          let errorMessage = 'Erro ao obter localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada pelo usuário';
              // Usar fallback em caso de permissão negada
              resolve(this.getDefaultLocation());
              return;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Informações de localização indisponíveis';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo esgotado ao obter localização';
              break;
          }
          
          reject(new Error(errorMessage));
        },
        defaultOptions
      );
    });
  }

  /**
   * Inicia monitoramento contínuo da localização
   */
  static startWatching(callback: (location: UserLocation | null) => void, options?: GeolocationOptions): void {
    if (!navigator.geolocation) {
      return;
    }

    this.callbacks.add(callback);

    // Se já estiver monitorando, apenas adiciona o callback
    if (this.watchId !== null) {
      return;
    }

    const defaultOptions: GeolocationOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // 1 minuto para watching
      ...options
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        // Notificar todos os callbacks
        this.callbacks.forEach(cb => cb(location));
      },
      (error) => {
        this.callbacks.forEach(cb => cb(null));
      },
      defaultOptions
    );
  }

  /**
   * Para monitoramento da localização
   */
  static stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.callbacks.clear();
  }

  /**
   * Remove um callback específico do monitoramento
   */
  static removeCallback(callback: (location: UserLocation | null) => void): void {
    this.callbacks.delete(callback);
    
    // Se não houver mais callbacks, para o monitoramento
    if (this.callbacks.size === 0) {
      this.stopWatching();
    }
  }

  /**
   * Calcula a distância entre dois pontos
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distância em km
  }

  private static toRad(value: number): number {
    return value * Math.PI / 180;
  }

  /**
   * Formata distância para exibição
   */
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }

  /**
   * Obtém localização padrão (fallback)
   */
  static getDefaultLocation(): UserLocation {
    // São Paulo - centro
    return {
      latitude: -23.5505,
      longitude: -46.6333
    };
  }

  /**
   * Verifica se o navegador suporta geolocalização
   */
  static isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Solicita permissão de localização (para browsers que suportam)
   */
  static async getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (error) {
      return 'prompt';
    }
  }

  /**
   * Obtém endereço reverso (opcional - requer API externa)
   */
  static async reverseGeocode(lat: number, lng: number): Promise<any> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      
      return {
        ...data.address,
        formatted: data.display_name
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Hook React para usar geolocalização
   */
  static useGeolocation(options?: GeolocationOptions) {
    const [location, setLocation] = React.useState<UserLocation | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      let mounted = true;

      const getLocation = async () => {
        try {
          setLoading(true);
          const loc = await this.getCurrentLocation(options);
          if (mounted) {
            setLocation(loc);
            setError(null);
          }
        } catch (err) {
          if (mounted) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
            // Usar localização padrão como fallback
            setLocation(this.getDefaultLocation());
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      getLocation();

      return () => {
        mounted = false;
      };
    }, [options?.enableHighAccuracy, options?.timeout, options?.maximumAge]);

    return { location, error, loading };
  }
}

// Exportar o hook separadamente para uso em componentes
export const useGeolocation = GeolocationService.useGeolocation;
