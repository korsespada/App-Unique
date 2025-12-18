
import { Product, Category } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: '350 V2 "Slate"',
    brand: 'Yeezy',
    category: 'Одежда',
    price: 34000,
    images: [
      'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584486520270-19eca1efcce5?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Иконический силуэт в расцветке Slate. Сочетание комфорта Primeknit и амортизации Boost.',
    details: ['Материал Primeknit', 'Технология Boost', 'Эксклюзивная расцветка']
  },
  {
    id: '2',
    name: 'Oyster Perpetual 41',
    brand: 'Rolex',
    category: 'Часы',
    price: 1240000,
    images: [
      'https://images.unsplash.com/photo-1547996160-81dfa63595aa?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Классика высокого часового искусства с бирюзовым циферблатом.',
    details: ['Сталь Oystersteel', 'Калибр 3230', 'Запас хода 70ч']
  },
  {
    id: '3',
    name: 'Keepall Bandoulière 50',
    brand: 'Louis Vuitton',
    category: 'Сумки',
    price: 260000,
    images: [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Идеальная дорожная сумка в канве Monogram Eclipse.',
    details: ['Канва с покрытием', 'Отделка из кожи коровы', 'Съемный ремень']
  },
  {
    id: '4',
    name: 'Love Bracelet',
    brand: 'Cartier',
    category: 'Ювелирка',
    price: 740000,
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1573408339311-2593f747d400?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Браслет Love — символ вечной любви и приверженности.',
    details: ['Золото 18 карат', 'Отвертка в комплекте', 'Классический дизайн']
  },
  {
    id: '5',
    name: 'Cashmere Hoodie',
    brand: 'Yeezy x Gap',
    category: 'Одежда',
    price: 45000,
    images: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Минималистичное худи из премиального кашемира.',
    details: ['100% кашемир', 'Свободный крой', 'Лимитированная серия']
  },
  {
    id: '6',
    name: 'Serpenti Forever',
    brand: 'Bvlgari',
    category: 'Сумки',
    price: 310000,
    images: [
      'https://images.unsplash.com/photo-1590739225287-bd31519780c3?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1566150905458-1bf1fd15dcb4?q=80&w=1000&auto=format&fit=crop'
    ],
    description: 'Элегантная сумка через плечо с фирменной застежкой в виде головы змеи.',
    details: ['Кожа теленка', 'Позолоченная фурнитура', 'Ручная работа']
  }
];

export const CATEGORIES: Category[] = ['Все', 'Одежда', 'Сумки', 'Ювелирка', 'Часы', 'Аксессуары'];
export const BRANDS = ['Все', 'Yeezy', 'Rolex', 'Louis Vuitton', 'Cartier', 'Bvlgari', 'Yeezy x Gap'];
