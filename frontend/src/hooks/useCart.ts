import { useState, useCallback } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image: string | null;
  stock: number;
}

function storageKey(slug: string) {
  return `amaarshop_cart_${slug}`;
}

function loadCart(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(slug: string, items: CartItem[]) {
  localStorage.setItem(storageKey(slug), JSON.stringify(items));
}

export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart(slug));

  const persist = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      saveCart(slug, next);
    },
    [slug],
  );

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, qty = 1) => {
      const current = loadCart(slug);
      const idx = current.findIndex((c) => c.productId === item.productId);
      if (idx >= 0) {
        current[idx].quantity = Math.min(current[idx].quantity + qty, current[idx].stock);
      } else {
        current.push({ ...item, quantity: Math.min(qty, item.stock) });
      }
      persist(current);
    },
    [slug, persist],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      const current = loadCart(slug);
      const idx = current.findIndex((c) => c.productId === productId);
      if (idx < 0) return;
      if (quantity <= 0) {
        current.splice(idx, 1);
      } else {
        current[idx].quantity = Math.min(quantity, current[idx].stock);
      }
      persist(current);
    },
    [slug, persist],
  );

  const removeItem = useCallback(
    (productId: string) => {
      const current = loadCart(slug).filter((c) => c.productId !== productId);
      persist(current);
    },
    [slug, persist],
  );

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const subtotal = items.reduce((sum, it) => sum + parseFloat(it.price) * it.quantity, 0);
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    totalQuantity,
  };
}
