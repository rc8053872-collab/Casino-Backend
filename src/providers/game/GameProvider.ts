export type Category = {
  id: string
  label: string
  icon: string
  image?: string
}

export type Game = {
  id: string
  name: string
  provider: string
  providerId?: string
  gameUid?: string
  category: string
  image: string
  thumbnail?: string
  banner?: string
  accent: string
  isHot?: boolean
  isNew?: boolean
  supportedCurrencies?: string[]
  status?: string
  isActive?: boolean
}

export interface GameProvider {
  getCategories(): Promise<Category[]>
  getProviders(): Promise<string[]>
  getGames(category?: string, inrOnly?: boolean, provider?: string, search?: string, page?: number, limit?: number): Promise<{ games: Game[]; pagination: any }>
  launchGame(gameId: string): Promise<{ sessionUrl: string }>
}

const categories: Category[] = [
  { id: 'hot', label: 'Hot', icon: '🔥', image: '/category/hot.png' },
  { id: 'slots', label: 'Slot', icon: '🎰', image: '/category/slot-new.png' },
  { id: 'minigames', label: 'Mini Games', icon: '🎲', image: '/category/stacked.jpg' },
  { id: 'sports', label: 'Sports', icon: '⚽', image: '/category/stacked.jpg' },
  { id: 'live', label: 'Live', icon: '💃', image: '/category/stacked.jpg' },
  { id: 'cards', label: 'Cards', icon: '🃏', image: '/category/stacked-2.jpg' },
  { id: 'fishing', label: 'Fishing', icon: '🦈', image: '/category/stacked-2.jpg' },
  { id: 'cockfight', label: 'Cockfight', icon: '🐓', image: '/category/stacked-2.jpg' },
  { id: 'lottery', label: 'Lottery', icon: '🎱', image: '/category/stacked-2.jpg' },
  { id: 'esports', label: 'E-Sports', icon: '🎮', image: '/category/stacked-2.jpg' },
  { id: 'demo', label: 'Demo', icon: '🕹️', image: '/category/stacked-2.jpg' },
]

const games: Game[] = [
  { id: 'neon-reels', name: 'Neon Reels', provider: 'JILI', category: 'slots', image: 'https://images.unsplash.com/photo-1518893883800-45cd0954574b?auto=format&fit=crop&w=700&q=80', accent: '#f5b83d', isHot: true },
  { id: 'dragon-tiger', name: 'Dragon Tiger', provider: 'Royal Table', category: 'table', image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=700&q=80', accent: '#e74b62', isHot: true },
  { id: 'lucky-nines', name: 'Lucky Nines', provider: 'PG', category: 'slots', image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=700&q=80', accent: '#49d7b0', isNew: true },
  { id: 'moon-princess', name: 'Moon Princess', provider: 'JDB', category: 'slots', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=700&q=80', accent: '#7d77ff', isNew: true },
  { id: 'royal-baccarat', name: 'Royal Baccarat', provider: 'Live Lounge', category: 'live', image: 'https://images.unsplash.com/photo-1605870445919-838d190e8e1b?auto=format&fit=crop&w=700&q=80', accent: '#e5a743', isHot: true },
  { id: 'turbo-football', name: 'Turbo Football', provider: 'Orbit Sports', category: 'sports', image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=700&q=80', accent: '#28b6d8' },
  { id: 'deep-sea', name: 'Deep Sea Riches', provider: 'Aqua Works', category: 'fishing', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=700&q=80', accent: '#3bd0e6' },
  { id: 'wild-west', name: 'Wild West Gold', provider: 'JILI', category: 'slots', image: 'https://images.unsplash.com/photo-1518623380242-d992d3c57b37?auto=format&fit=crop&w=700&q=80', accent: '#e9893c' },
  { id: 'candy-crush', name: 'Candy Super', provider: 'PG', category: 'slots', image: '/icons/slot_main.jpg', accent: '#e9893c' },
  { id: 'dragon-tiger-2', name: 'Dragon Tiger', provider: 'JDB', category: 'slots', image: '/icons/dragon_main.jpg', accent: '#e9893c' },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

import { apiClient } from '../api/client';

export const liveGameProvider: GameProvider = {
  async getCategories() {
    return categories; // Can still mock categories or map dynamically
  },
  async getProviders() {
    try {
      const response = await apiClient.get<any, any>('/games/providers');
      return response;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async getGames(category = 'all', inrOnly = true, provider?: string, search?: string, page: number = 1, limit: number = 40) {
    try {
      let url = `/games/catalog?inrOnly=${inrOnly}&page=${page}&limit=${limit}`;
      if (provider && provider !== 'All') {
        url += `&provider=${encodeURIComponent(provider)}`;
      }
      if (category && category !== 'all' && category !== 'hot') {
        url += `&category=${encodeURIComponent(category)}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await apiClient.get<any, any>(url);
      const dbGames = response.games || [];
      const pagination = response.pagination || { total: 0, page: 1, limit: 40, totalPages: 1 };

      // Map backend games to frontend Game type
      const mapped = dbGames.map((g: any) => {
        let imageUrl = g.thumbnail || '';
        const n = g.name.toLowerCase();
        let providerName = g.provider || g.providerId || 'JILI';
        
        if (n.includes('aviator') && !g.thumbnail) {
           imageUrl = '/icons/aviator_main.jpg';
           providerName = 'SPRIBE';
        }
        else if (n.includes('dragon tiger') && !g.thumbnail) {
           imageUrl = '/icons/dragon_main.jpg';
        }
        else if (n.includes('roulette') && !g.thumbnail) {
           imageUrl = '/icons/roulette_main.jpg';
        }
        
        return {
          id: g.slug || g.id,
          name: g.name,
          provider: providerName,
          providerId: g.providerId,
          gameUid: g.gameUid || g.providerId,
          category: g.category || 'slots',
          thumbnail: g.thumbnail,
          banner: g.banner,
          image: imageUrl,
          accent: '#f5b83d',
          isHot: (g.displayOrder > 0 && g.displayOrder <= 5) || g.isHot || g.isPopular || g.isFeatured,
          supportedCurrencies: g.supportedCurrencies || ['INR'],
          status: g.status,
          isActive: g.isActive
        };
      });

      return {
        games: mapped,
        pagination
      };
    } catch (err) {
      console.error(err);
      return { games: [], pagination: { total: 0, page: 1, limit: 40, totalPages: 1 } }; 
    }
  },
  async launchGame(gameUid) {
    try {
      const response = await apiClient.post<any, any>('/v1/games/launch', {
        game_uid: gameUid
      });
      return { sessionUrl: response.launch_url };
    } catch (err: any) {
      const errorMessage = err.message || err.error || 'Failed to launch game. Please try again.';
      alert(errorMessage);
      throw err;
    }
  },
}
