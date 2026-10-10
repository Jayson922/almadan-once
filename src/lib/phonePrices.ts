export interface PhonePrice {
  id: string;
  name: string;
  storage: string;
  minPrice: number;
  maxPrice: number;
  updatedAt: string;
}

export const PHONE_PRICE_TABLE: PhonePrice[] = [
  // --- APPLE iPHONE ---
  { id: "iphone-11-64", name: "Apple iPhone 11", storage: "64 GB", minPrice: 10000, maxPrice: 14500, updatedAt: "2026-10-01" },
  { id: "iphone-11-128", name: "Apple iPhone 11", storage: "128 GB", minPrice: 12000, maxPrice: 16500, updatedAt: "2026-10-01" },
  { id: "iphone-12-64", name: "Apple iPhone 12", storage: "64 GB", minPrice: 14000, maxPrice: 19000, updatedAt: "2026-10-01" },
  { id: "iphone-12-128", name: "Apple iPhone 12", storage: "128 GB", minPrice: 16000, maxPrice: 21500, updatedAt: "2026-10-01" },
  { id: "iphone-13-128", name: "Apple iPhone 13", storage: "128 GB", minPrice: 20000, maxPrice: 30000, updatedAt: "2026-10-01" },
  { id: "iphone-13-256", name: "Apple iPhone 13", storage: "256 GB", minPrice: 23000, maxPrice: 33500, updatedAt: "2026-10-01" },
  { id: "iphone-13-pro-128", name: "Apple iPhone 13 Pro", storage: "128 GB", minPrice: 28000, maxPrice: 38000, updatedAt: "2026-10-01" },
  { id: "iphone-14-128", name: "Apple iPhone 14", storage: "128 GB", minPrice: 26000, maxPrice: 36000, updatedAt: "2026-10-01" },
  { id: "iphone-14-pro-128", name: "Apple iPhone 14 Pro", storage: "128 GB", minPrice: 36000, maxPrice: 47000, updatedAt: "2026-10-01" },
  { id: "iphone-14-pro-max-128", name: "Apple iPhone 14 Pro Max", storage: "128 GB", minPrice: 40000, maxPrice: 52000, updatedAt: "2026-10-01" },
  { id: "iphone-15-128", name: "Apple iPhone 15", storage: "128 GB", minPrice: 35000, maxPrice: 46000, updatedAt: "2026-10-01" },
  { id: "iphone-15-pro-128", name: "Apple iPhone 15 Pro", storage: "128 GB", minPrice: 46000, maxPrice: 58000, updatedAt: "2026-10-01" },
  { id: "iphone-15-pro-max-256", name: "Apple iPhone 15 Pro Max", storage: "256 GB", minPrice: 55000, maxPrice: 70000, updatedAt: "2026-10-01" },
  { id: "iphone-16-128", name: "Apple iPhone 16", storage: "128 GB", minPrice: 45000, maxPrice: 58000, updatedAt: "2026-10-01" },
  { id: "iphone-16-pro-128", name: "Apple iPhone 16 Pro", storage: "128 GB", minPrice: 60000, maxPrice: 75000, updatedAt: "2026-10-01" },

  // --- SAMSUNG GALAXY ---
  { id: "samsung-s21-128", name: "Samsung Galaxy S21", storage: "128 GB", minPrice: 9000, maxPrice: 13500, updatedAt: "2026-10-01" },
  { id: "samsung-s22-128", name: "Samsung Galaxy S22", storage: "128 GB", minPrice: 13000, maxPrice: 18500, updatedAt: "2026-10-01" },
  { id: "samsung-s23-128", name: "Samsung Galaxy S23", storage: "128 GB", minPrice: 19000, maxPrice: 26000, updatedAt: "2026-10-01" },
  { id: "samsung-s23-ultra-256", name: "Samsung Galaxy S23 Ultra", storage: "256 GB", minPrice: 29000, maxPrice: 39000, updatedAt: "2026-10-01" },
  { id: "samsung-s24-128", name: "Samsung Galaxy S24", storage: "128 GB", minPrice: 27000, maxPrice: 35000, updatedAt: "2026-10-01" },
  { id: "samsung-s24-ultra-256", name: "Samsung Galaxy S24 Ultra", storage: "256 GB", minPrice: 42000, maxPrice: 55000, updatedAt: "2026-10-01" },
  { id: "samsung-a54-128", name: "Samsung Galaxy A54", storage: "128 GB", minPrice: 8500, maxPrice: 12500, updatedAt: "2026-10-01" },
  { id: "samsung-a55-128", name: "Samsung Galaxy A55", storage: "128 GB", minPrice: 11000, maxPrice: 15500, updatedAt: "2026-10-01" },

  // --- XIAOMI & REDMI ---
  { id: "xiaomi-13t-256", name: "Xiaomi 13T", storage: "256 GB", minPrice: 14000, maxPrice: 19500, updatedAt: "2026-10-01" },
  { id: "redmi-note-12-pro-128", name: "Redmi Note 12 Pro", storage: "128 GB", minPrice: 6500, maxPrice: 9500, updatedAt: "2026-10-01" },
  { id: "redmi-note-13-pro-256", name: "Redmi Note 13 Pro", storage: "256 GB", minPrice: 9500, maxPrice: 13500, updatedAt: "2026-10-01" },
];