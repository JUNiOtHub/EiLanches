interface Shop {
  id: string;
  nomeLoja?: string;
  name?: string;
  rating?: number;
  deliveryTime?: string;
  isOpen?: boolean;
  category?: string;
  latitude?: number;
  longitude?: number;
  totalOrders?: number;
  cancellationRate?: number;
  avgPreparationTime?: number;
  feedbackTags?: string[];
  createdAt?: string;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface RankingMetrics {
  proximityScore: number;
  ratingScore: number;
  availabilityScore: number;
  popularityScore: number;
  reliabilityScore: number;
  finalScore: number;
}

export class ShopRankingService {
  /**
   * Calcula distância entre dois pontos usando fórmula de Haversine
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
   * Converte tempo de entrega (string) para minutos (número)
   */
  static parseDeliveryTime(deliveryTime?: string): number {
    if (!deliveryTime) return 30; // Default 30 minutos
    
    // Padrões: "30-40 min", "20-30 min", "15-25 min"
    const match = deliveryTime.match(/(\d+)-(\d+)/);
    if (match) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      return (min + max) / 2; // Média do intervalo
    }
    
    // Padrão: "30 min"
    const singleMatch = deliveryTime.match(/(\d+)/);
    return singleMatch ? parseInt(singleMatch[1]) : 30;
  }

  /**
   * Calcula score de proximidade (0-100)
   */
  static calculateProximityScore(
    shop: Shop, 
    userLocation: UserLocation
  ): number {
    if (!shop.latitude || !shop.longitude) return 50; // Score médio se não tiver localização
    
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      shop.latitude,
      shop.longitude
    );

    // Score baseado na distância:
    // 0-1km = 100 pontos
    // 1-3km = 80 pontos  
    // 3-5km = 60 pontos
    // 5-10km = 40 pontos
    // 10km+ = 20 pontos
    if (distance <= 1) return 100;
    if (distance <= 3) return 80;
    if (distance <= 5) return 60;
    if (distance <= 10) return 40;
    return 20;
  }

  /**
   * Calcula score de avaliação (0-100)
   */
  static calculateRatingScore(shop: Shop): number {
    const rating = shop.rating || 0;
    
    // Normalização: 5 estrelas = 100 pontos
    return Math.min(rating * 20, 100);
  }

  /**
   * Calcula score de disponibilidade (0-100)
   */
  static calculateAvailabilityScore(shop: Shop): number {
    return shop.isOpen ? 100 : 0;
  }

  /**
   * Calcula score de popularidade (0-100)
   */
  static calculatePopularityScore(shop: Shop): number {
    const orders = shop.totalOrders || 0;
    
    // Baseado no número de pedidos:
    // 0-10 = 20 pontos
    // 11-50 = 40 pontos
    // 51-100 = 60 pontos
    // 101-500 = 80 pontos
    // 500+ = 100 pontos
    if (orders <= 10) return 20;
    if (orders <= 50) return 40;
    if (orders <= 100) return 60;
    if (orders <= 500) return 80;
    return 100;
  }

  /**
   * Calcula score de confiabilidade (0-100)
   */
  static calculateReliabilityScore(shop: Shop): number {
    const cancellationRate = shop.cancellationRate || 0.1; // Default 10%
    const avgPrepTime = shop.avgPreparationTime || 30; // Default 30 minutos
    
    // Score baseado na taxa de cancelamento (inverso)
    const cancellationScore = Math.max(0, 100 - (cancellationRate * 100));
    
    // Score baseado no tempo médio de preparo
    const prepTimeScore = Math.max(0, 100 - (avgPrepTime - 15) * 2); // 15min = 100pts
    
    return (cancellationScore + prepTimeScore) / 2;
  }

  /**
   * Calcula métricas completas de ranking para uma loja
   */
  static calculateRankingMetrics(
    shop: Shop, 
    userLocation: UserLocation
  ): RankingMetrics {
    const proximityScore = this.calculateProximityScore(shop, userLocation);
    const ratingScore = this.calculateRatingScore(shop);
    const availabilityScore = this.calculateAvailabilityScore(shop);
    const popularityScore = this.calculatePopularityScore(shop);
    const reliabilityScore = this.calculateReliabilityScore(shop);

    // Pesos das métricas (total 100%):
    // Proximidade: 30%
    // Avaliação: 25%
    // Disponibilidade: 20%
    // Popularidade: 15%
    // Confiabilidade: 10%
    const finalScore = 
      (proximityScore * 0.3) +
      (ratingScore * 0.25) +
      (availabilityScore * 0.2) +
      (popularityScore * 0.15) +
      (reliabilityScore * 0.1);

    return {
      proximityScore,
      ratingScore,
      availabilityScore,
      popularityScore,
      reliabilityScore,
      finalScore
    };
  }

  /**
   * Ordena lojas baseado no algoritmo de ranking
   */
  static rankShops(
    shops: Shop[], 
    userLocation: UserLocation
  ): Shop[] {
    return shops
      .map(shop => ({
        ...shop,
        rankingMetrics: this.calculateRankingMetrics(shop, userLocation)
      }))
      .sort((a, b) => b.rankingMetrics.finalScore - a.rankingMetrics.finalScore);
  }

  /**
   * Filtra lojas por categoria
   */
  static filterByCategory(shops: Shop[], category: string | null): Shop[] {
    if (!category) return shops;
    
    return shops.filter(shop => {
      const shopCategory = (shop.category || '').toLowerCase();
      const searchCategory = category.toLowerCase();
      
      // Busca exata ou parcial na categoria
      return shopCategory.includes(searchCategory) || searchCategory.includes(shopCategory);
    });
  }

  /**
   * Filtra lojas por raio de distância
   */
  static filterByDistance(
    shops: Shop[], 
    userLocation: UserLocation, 
    maxDistanceKm: number = 15
  ): Shop[] {
    return shops.filter(shop => {
      if (!shop.latitude || !shop.longitude) return true; // Incluir se não tiver localização
      
      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        shop.latitude,
        shop.longitude
      );
      
      return distance <= maxDistanceKm;
    });
  }

  /**
   * Obtém lojas em destaque (carrosseis temáticos)
   */
  static getFeaturedShops(shops: Shop[], userLocation: UserLocation): {
    topRated: Shop[];
    nearby: Shop[];
    newShops: Shop[];
    superPartners: Shop[];
  } {
    const rankedShops = this.rankShops(shops, userLocation);
    
    // Top rated (melhor avaliadas)
    const topRated = rankedShops
      .filter(shop => (shop.rating || 0) >= 4.5)
      .slice(0, 5);

    // Nearby (mais próximas)
    const nearby = rankedShops
      .filter(shop => {
        if (!shop.latitude || !shop.longitude) return false;
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          shop.latitude,
          shop.longitude
        );
        return distance <= 2; // 2km de raio
      })
      .slice(0, 5);

    // New shops (mais recentes - últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newShops = rankedShops
      .filter(shop => {
        if (!shop.createdAt) return false;
        return new Date(shop.createdAt) >= thirtyDaysAgo;
      })
      .slice(0, 5);

    // Super partners (selo especial)
    const superPartners = rankedShops
      .filter(shop => 
        (shop.rating || 0) >= 4.8 && 
        (shop.totalOrders || 0) >= 50
      )
      .slice(0, 5);

    return {
      topRated,
      nearby,
      newShops,
      superPartners
    };
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
   * Verifica se loja tem selo "Super Parceiro"
   */
  static isSuperPartner(shop: Shop): boolean {
    return (shop.rating || 0) >= 4.8 && (shop.totalOrders || 0) >= 50;
  }

  /**
   * Obtém tags de feedback para exibição
   */
  static getFeedbackTags(shop: Shop): string[] {
    const tags: string[] = [];
    const feedbackTags = shop.feedbackTags || [];

    // Tags baseadas em métricas
    if ((shop.rating || 0) >= 4.7) tags.push('⭐ Top Avaliada');
    if (this.parseDeliveryTime(shop.deliveryTime) <= 25) tags.push('🚀 Entrega Rápida');
    if (this.isSuperPartner(shop)) tags.push('🏆 Super Parceiro');
    if ((shop.cancellationRate || 0.1) <= 0.05) tags.push('✅ Confiável');
    
    // Tags customizadas do feedback
    if (feedbackTags.includes('Lanche Quente')) tags.push('🔥 Lanche Quente');
    if (feedbackTags.includes('Bem Embalado')) tags.push('📦 Bem Embalado');
    if (feedbackTags.includes('Custo-Benefício')) tags.push('💰 Custo-Benefício');

    return tags.slice(0, 3); // Máximo 3 tags
  }
}
