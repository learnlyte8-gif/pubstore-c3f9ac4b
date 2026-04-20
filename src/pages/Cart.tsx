import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function Cart() {
  const { cartProducts, updateQty, removeFromCart, cartTotal, clearCart } = useShop();
  const shipping = cartTotal > 25 || cartTotal === 0 ? 0 : 4.99;
  const total = cartTotal + shipping;

  if (cartProducts.length === 0) {
    return (
      <div className="px-6 pt-16 pb-24 text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
          <ShoppingBag className="w-9 h-9 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          Browse the marketplace and add items you love.
        </p>
        <Link to="/home">
          <Button className="mt-6 h-11 px-6 rounded-full bg-primary text-primary-foreground">
            Start shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Cart ({cartProducts.length})</h1>
        <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive">
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-border">
        {cartProducts.map(({ product, qty }) => (
          <li key={product.id} className="flex gap-3 px-4 py-3">
            <img
              src={product.image}
              alt={product.title}
              loading="lazy"
              className="w-20 h-20 rounded-lg object-cover bg-muted shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-sm leading-snug line-clamp-2">{product.title}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-base font-bold text-destructive">{fmt(product.price)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(product.id, qty - 1)}
                    aria-label="Decrease"
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    onClick={() => updateQty(product.id, qty + 1)}
                    aria-label="Increase"
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromCart(product.id)}
                    aria-label="Remove"
                    className="ml-1 w-7 h-7 text-muted-foreground hover:text-destructive flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Sticky checkout bar */}
      <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 bg-background border-t border-border safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Total · {shipping === 0 ? "Free shipping" : `+ ${fmt(shipping)} ship`}</p>
            <p className="text-lg font-bold text-destructive leading-tight">{fmt(total)}</p>
          </div>
          <Button className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold">
            Checkout <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
