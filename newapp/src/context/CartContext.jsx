import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  function addItem(product, quantity = 1, variant = null) {
    setItems((prev) => {
      const key = variant ? `${product.id}_${variant}` : `${product.id}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => i.key === key ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { key, product, quantity, variant }];
    });
    setIsOpen(true);
  }

  function removeItem(key) { setItems((prev) => prev.filter((i) => i.key !== key)); }

  function updateQuantity(key, quantity) {
    if (quantity <= 0) { removeItem(key); return; }
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, quantity } : i));
  }

  function clearCart() { setItems([]); }

  const total = items.reduce((sum, i) => {
    const price = parseFloat(i.product.price_ttc ?? i.product.price ?? 0);
    return sum + price * i.quantity;
  }, 0);

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, cartCount, isOpen, setIsOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }
