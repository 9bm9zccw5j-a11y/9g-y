import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Trash2,
  X,
  Search,
  Plus,
  Minus,
  Wrench,
  Phone,
  Lock as LockIcon,
  BadgePercent,
  CreditCard,
  Store,
  UserRound,
  CalendarClock,
} from "lucide-react";
import type { Product } from "./data/catalog";
import { useProducts } from "./hooks/useProducts";
import { useCategories } from "./hooks/useCategories";
import { useBrands } from "./hooks/useBrands";
import { cloudSync } from "./utils/cloudSync";
import PumpCalculator, { type PumpModel } from "./components/PumpCalculator";
import AdminPanel from "./components/AdminPanel";
import CustomerAccount from "./components/CustomerAccount";
import PlumbersList from "./components/PlumbersList";
import ShopView from "./components/ShopView";
import { useLoyalty, LOYALTY_DISCOUNT, LOYALTY_THRESHOLD } from "./hooks/useLoyalty";
import { usePlumbers } from "./hooks/usePlumbers";
import { useMediaLibrary } from "./hooks/useMediaLibrary";
import { useOrders } from "./hooks/useOrders";
import { useAppRoute } from "./hooks/useAppRoute";
import { formatDeliveryDate, isPreOrder, upcomingDeliveries } from "./utils/delivery";
import { productThumb } from "./utils/thumb";
import type { OrderItem, PaymentMethod } from "./data/orders";

type CartItem = {
  product: Product;
  quantity: number;
  meters?: number;
};

export const LOGO_URL =
  "https://s6.iimage.su/s/29/g5urSH9xBFRhqs09tzQPDHqzUsE0eIWtmmtjHsSac.jpg";

const MENU_ITEMS = [
  { key: "plumbers", label: "Сантехники", icon: Wrench, bg: "bg-teal-500" },
  { key: "contacts", label: "Контакты", icon: Phone, bg: "bg-orange-400" },
  { key: "account", label: "Личный кабинет", icon: UserRound, bg: "bg-teal-600" },
  { key: "admin", label: "Админ-панель", icon: LockIcon, bg: "bg-slate-700" },
] as const;

function itemTotal(item: CartItem): number {
  if (item.product.unit === "м" && item.meters) {
    return item.product.price * item.meters * item.quantity;
  }
  return item.product.price * item.quantity;
}
function minMeters(p: Product): number {
  return p.minMeters && p.minMeters > 0 ? p.minMeters : 1;
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState<{
    number: string;
    paymentMethod: PaymentMethod;
    cardAfterPayment: boolean;
  } | null>(null);
  const loyalty = useLoyalty();
  const plumbers = usePlumbers();
  const brandsApi = useBrands();
  const mediaLibrary = useMediaLibrary();
  const ordersApi = useOrders();
  const { path, navigate } = useAppRoute();
  const adminOpen = path === "/admin";
  const accountOpen = path === "/account" || path.startsWith("/account/");
  const plumbersOpen = path === "/plumbers" || path.startsWith("/plumbers/");
  const {
    products,
    updateProduct,
    addProduct,
    deleteProduct,
    swapProducts,
    resetCatalog,
    productsSyncStatus,
    productsLoading,
  } = useProducts();
  const {
    categories,
    updateCategory,
    addCategory,
    deleteCategory,
    moveCategory,
    resetCategories,
    categoriesLoading,
  } = useCategories();
  const catalogLoading = productsLoading || categoriesLoading;
  // Логотип берём из медиатеки: загрузите файл с именем logo.png во вкладке «Медиа».
  // Пока библиотека грузится, оставляем исходный логотип как безопасный fallback.
  const uploadedLogo = mediaLibrary.items.find(
    (item) => item.name.trim().toLowerCase() === "logo.png"
  );
  const siteLogoUrl = uploadedLogo?.dataUrl || LOGO_URL;
  const emptyCartImage = mediaLibrary.items.find(
    (item) => item.name.trim().toLowerCase() === "cart.png"
  );
  const uploadedCardBackground = mediaLibrary.items.find(
    (item) => item.name.trim().toLowerCase() === "discount-card-background.png"
  );
  const discountCardBackgroundUrl = uploadedCardBackground?.dataUrl;

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === p.id);
      if (idx > -1) {
        const updated = [...prev];
        if (p.unit === "м") {
          const step = minMeters(p);
          updated[idx] = {
            ...updated[idx],
            meters: (updated[idx].meters ?? step) + step,
          };
        } else {
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        }
        return updated;
      }
      if (p.unit === "м") {
        return [...prev, { product: p, quantity: 1, meters: minMeters(p) }];
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalCount = cart.reduce((s, item) => s + item.quantity, 0);
  const totalSum = cart.reduce((s, item) => s + itemTotal(item), 0);

  const openMenuItem = (key: string) => {
    setMenuOpen(false);
    if (key === "admin") {
      navigate("/admin");
      return;
    }
    if (key === "account") {
      navigate("/account");
      return;
    }
    if (key === "plumbers") {
      navigate("/plumbers");
      return;
    }
    if (key === "contacts") {
      setTimeout(() => {
        alert(
          "Контакты магазина «Водяной»\n\nАдрес: г. Луга, пр. Кирова, д. 80\nТелефон: +7 (900) 123-45-67\nWhatsApp / Telegram: +7 (900) 123-45-67\nE-mail: info@vodyanoy.ru\n\nРежим работы:\nПн–Пт: 09:00 – 19:00\nСб: 10:00 – 17:00\nВс: выходной\n\nДоставка по городу — от 300 ₽, самовывоз бесплатно."
        );
      }, 100);
    }
  };

  const syncSupabaseNow = async () => {
    const test = await cloudSync.selfTest();
    if (!test.ok) {
      return { ok: false, message: test.message };
    }

    // Никогда не перезаписываем каталог пустыми данными до завершения загрузки.
    if (!products.length || !categories.length) {
      return {
        ok: false,
        message: "Каталог ещё загружается. Подождите несколько секунд.",
      };
    }

    const tasks = [cloudSync.saveProducts(products), cloudSync.saveCategories(categories)];
    if (ordersApi.orders.length) tasks.push(cloudSync.saveOrders(ordersApi.orders));
    if (loyalty.users.length) tasks.push(cloudSync.saveLoyaltyUsers(loyalty.users));
    if (plumbers.plumbers.length) tasks.push(cloudSync.savePlumbers(plumbers.plumbers));
    if (mediaLibrary.items.length) tasks.push(cloudSync.saveMedia(mediaLibrary.items));
    if (brandsApi.brands.length) tasks.push(cloudSync.saveBrands(brandsApi.brands));
    const results = await Promise.all(tasks);
    if (results.some((ok) => !ok)) {
      return {
        ok: false,
        message: cloudSync.getLastError() || "Не удалось записать данные",
      };
    }
    return { ok: true, message: "Данные выгружены в облако ✅" };
  };

  const loyaltyActive = loyalty.currentUser?.status === "active";
  // Карта выдаётся при покупке от 25 000 ₽ — такой заказ сразу идёт со скидкой 5%,
  // даже если у покупателя карты ещё нет. Иначе цена со скидкой в карточке товара
  // превращалась бы в полную цену в корзине.
  const instantCard = !loyaltyActive && totalSum >= LOYALTY_THRESHOLD;
  const discountApplies = loyaltyActive || instantCard;
  const cartDiscount = discountApplies && totalCount > 0 ? Math.round(totalSum * LOYALTY_DISCOUNT) : 0;
  const cartTotal = totalSum - cartDiscount;

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-[#f2f6f8]">
      <ShopView
        products={products}
        categories={categories}
        cart={cart}
        onAdd={addToCart}
        onOpenCart={() => setCartOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenAccount={() => navigate("/account")}
        routePath={path}
        onNavigate={navigate}
        totalCount={totalCount}
        loading={catalogLoading}
        logoUrl={siteLogoUrl}
        mediaItems={mediaLibrary.items}
        brands={brandsApi.brands}
      />

      {/* ---------- Cart sheet ---------- */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-40 mx-auto max-h-[75%] w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
            >
              <div className="flex items-center border-b border-slate-100 px-5 py-4">
                <h3 className="text-lg font-black text-slate-800">Корзина ({totalCount})</h3>
                <button onClick={() => setCartOpen(false)} className="ml-auto text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto px-4 py-3">
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    {emptyCartImage ? (
                      <img
                        src={emptyCartImage.dataUrl}
                        alt="Пустая корзина"
                        className="mx-auto mb-4 h-[200px] w-[200px] object-contain"
                      />
                    ) : (
                      <Search className="mx-auto mb-3 opacity-40" size={34} />
                    )}
                    <p className="text-sm font-medium">Корзина пуста</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-slate-50 p-3 shadow-xs"
                      >
                        <img
                          src={productThumb(item.product)}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-bold text-slate-800">
                            {item.product.name}
                          </div>
                          <div className="mt-0.5 text-[11.5px] font-medium text-slate-400">
                            {item.product.price.toLocaleString("ru-RU")} ₽ /{" "}
                            {item.product.unit === "м" ? "м" : "шт."}
                            {item.product.unit === "м" && item.meters && <> · {item.meters} м</>}
                          </div>
                          <div className="mt-0.5 text-[14px] font-black text-teal-700">
                            {itemTotal(item).toLocaleString("ru-RU")} ₽
                          </div>
                        </div>

                        {item.product.unit === "м" ? (
                          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                            <button
                              onClick={() => {
                                const step = minMeters(item.product);
                                const next = (item.meters ?? step) - step;
                                if (next < step) {
                                  setCart((prev) =>
                                    prev.filter((c) => c.product.id !== item.product.id)
                                  );
                                } else {
                                  setCart((prev) =>
                                    prev.map((c) =>
                                      c.product.id === item.product.id ? { ...c, meters: next } : c
                                    )
                                  );
                                }
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
                              title="Меньше"
                            >
                              <Minus size={13} strokeWidth={2.5} />
                            </button>
                            <span className="min-w-[28px] text-center text-[12px] font-extrabold text-slate-800">
                              {item.meters} м
                            </span>
                            <button
                              onClick={() => {
                                const step = minMeters(item.product);
                                setCart((prev) =>
                                  prev.map((c) =>
                                    c.product.id === item.product.id
                                      ? { ...c, meters: (c.meters ?? step) + step }
                                      : c
                                  )
                                );
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 text-white shadow-xs transition hover:bg-teal-600 active:scale-95"
                              title="Больше"
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
                              title="Уменьшить"
                            >
                              <Minus size={13} strokeWidth={2.5} />
                            </button>
                            <span className="min-w-[20px] text-center text-[13.5px] font-extrabold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 text-white shadow-xs transition hover:bg-teal-600 active:scale-95"
                              title="Увеличить"
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-slate-300 transition hover:text-red-500 active:scale-90"
                          title="Удалить"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 px-5 py-4">
                {cart.some((item) => isPreOrder(item.product)) && (
                  <div className="mb-2 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-[12.5px] font-semibold leading-relaxed text-orange-700">
                    <CalendarClock size={16} className="mt-0.5 shrink-0" />
                    <span>
                      В корзине есть товар <b className="font-black">под заказ</b>: ближайший привоз от Triton —{" "}
                      <b className="font-black">{formatDeliveryDate(upcomingDeliveries()[0].delivery)}</b> в магазин «Водяной».
                    </span>
                  </div>
                )}
                {discountApplies && totalCount > 0 && (
                  <div className="mb-2 flex items-center rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
                    <BadgePercent size={15} className="shrink-0" />
                    <span className="ml-2 text-[12.5px] font-bold">
                      {instantCard
                        ? "Скидка −5%: карту вы получите с этим заказом"
                        : "Скидка по карте −5%"}
                    </span>
                    <span className="ml-auto text-[13px] font-black">
                      −{cartDiscount.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <div className="mb-3 flex items-center">
                  <span className="text-sm font-semibold text-slate-500">Итого</span>
                  {discountApplies && totalCount > 0 && (
                    <span className="ml-auto text-[14px] font-bold text-slate-400 line-through">
                      {totalSum.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                  <span
                    className={`font-black text-slate-800 ${
                      discountApplies && totalCount > 0 ? "ml-2 text-2xl" : "ml-auto text-2xl"
                    }`}
                  >
                    {cartTotal.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <button
                  disabled={!totalCount}
                  onClick={() => {
                    setCartOpen(false);
                    setTimeout(() => setCheckoutOpen(true), 250);
                  }}
                  className="w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3.5 text-[15px] font-black text-white shadow-lg shadow-orange-500/25 active:scale-[0.98] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  Оформить заказ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------- Menu sheet ---------- */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-40 mx-auto max-h-[80%] w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
            >
              <div className="flex flex-col items-center pt-2.5">
                <span className="h-1.5 w-14 rounded-full bg-slate-200" />
              </div>
              <div className="flex items-center px-5 py-3.5">
                <h3 className="text-lg font-black text-slate-800">Меню</h3>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="ml-auto text-slate-400 active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 px-4 pb-6">
                {MENU_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => openMenuItem(item.key)}
                    className="relative flex flex-col items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-5 transition active:scale-95"
                  >
                    {item.key === "account" && loyaltyActive && (
                      <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                        <CheckCircle2 size={13} strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${item.bg} shadow-sm`}
                    >
                      <item.icon size={26} strokeWidth={2.2} className="text-white" />
                    </span>
                    <span className="text-[14px] font-black text-slate-800">{item.label}</span>
                    {item.key === "account" && (
                      <span className={`-mt-1 text-[10px] font-bold ${
                        loyaltyActive ? "text-emerald-600" : "text-teal-600"
                      }`}>
                        {loyalty.currentUser ? "Покупки и скидки" : "История покупок · карта"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------- Pump calculator ---------- */}
      <PumpCalculator
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        onPick={(m: PumpModel, head: number) => {
          setCalcOpen(false);
          setTimeout(() => {
            alert(
              `Отличный выбор! 💧\n\n${m.name}\n• Максимальный напор: ${m.maxHead} м (нужен ${head} м)\n• Производительность: ${m.flow} м³/ч\n• Мощность: ${m.power} Вт\n• Кабель: ${m.cable} м\n• Цена: ${m.price.toLocaleString("ru-RU")} ₽\n\nДля монтажа также понадобятся обратный клапан и фитинги.`
            );
          }, 100);
        }}
      />

      {/* ---------- Customer account: история покупок + карта лояльности ---------- */}
      <CustomerAccount
        open={accountOpen}
        onClose={() => navigate("/")}
        routePath={path}
        onNavigate={navigate}
        loyalty={loyalty}
        logoUrl={siteLogoUrl}
        cardBackgroundUrl={discountCardBackgroundUrl}
        mediaItems={mediaLibrary.items}
      />

      {/* ---------- Plumbers list ---------- */}
      <PlumbersList
        open={plumbersOpen}
        onClose={() => navigate("/")}
        plumbers={plumbers.plumbers}
        onAddReview={plumbers.addReview}
      />

      {/* ---------- Admin panel ---------- */}
      <AdminPanel
        open={adminOpen}
        onClose={() => navigate("/")}
        products={products}
        onUpdate={updateProduct}
        onAdd={addProduct}
        onDelete={deleteProduct}
        onSwap={swapProducts}
        onReset={resetCatalog}
        categories={categories}
        onUpdateCategory={updateCategory}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onMoveCategory={moveCategory}
        onResetCategories={resetCategories}
        syncStatus={productsSyncStatus}
        loyaltyUsers={loyalty.users}
        onSetReceiptStatus={loyalty.setReceiptStatus}
        onActivateUser={loyalty.activateUser}
        onSync={syncSupabaseNow}
        plumbers={plumbers.plumbers}
        onAddPlumber={plumbers.addPlumber}
        onUpdatePlumber={plumbers.updatePlumber}
        onDeletePlumber={plumbers.deletePlumber}
        brands={brandsApi.brands}
        onAddBrand={brandsApi.addBrand}
        onUpdateBrand={brandsApi.updateBrand}
        onDeleteBrand={brandsApi.deleteBrand}
      />

      {/* ---------- Checkout: выбор способа оплаты ---------- */}
      <AnimatePresence>
        {checkoutOpen && (
          <CheckoutSheet
            onClose={() => setCheckoutOpen(false)}
            cart={cart}
            totalSum={totalSum}
            loyaltyActive={loyaltyActive}
            instantCard={instantCard}
            defaultName={loyalty.currentUser ? `${loyalty.currentUser.firstName} ${loyalty.currentUser.lastName}` : ""}
            defaultPhone={loyalty.currentUser?.phone || ""}
            onSubmit={(customer) => {
              const items: OrderItem[] = cart.map((c) => ({
                productId: c.product.id,
                name: c.product.name,
                price: c.product.price,
                unit: c.product.unit,
                quantity: c.quantity,
                meters: c.meters,
                sum: itemTotal(c),
              }));
              const discount = discountApplies ? Math.round(totalSum * LOYALTY_DISCOUNT) : 0;
              const total = totalSum - discount;
              const status = customer.paymentMethod === "online" ? "created_online" : "created_shop";
              // Заявка на карту создаётся только после оплаты — в админке кнопкой
              // «Подтвердить оплату», а не в момент оформления заказа. Здесь заказ
              // просто привязываем к текущему аккаунту, если покупатель вошёл.
              const loyaltyUserId = loyalty.currentUser?.id;
              const cardAfterPayment =
                totalSum >= LOYALTY_THRESHOLD && loyalty.currentUser?.status !== "active";
              const order = ordersApi.addOrder({
                status,
                paymentMethod: customer.paymentMethod,
                subtotal: totalSum,
                discount,
                total,
                customerName: customer.name,
                customerPhone: customer.phone,
                comment: customer.comment || undefined,
                loyaltyUserId,
                items,
              });
              setCart([]);
              setCheckoutOpen(false);
              setOrderDone({ number: order.number, paymentMethod: customer.paymentMethod, cardAfterPayment });
            }}
          />
        )}
      </AnimatePresence>

      {/* ---------- Уведомление об успешном заказе ---------- */}
      <AnimatePresence>
        {orderDone && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderDone(null)}
              className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="absolute left-1/2 top-1/2 z-50 w-[min(360px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <CheckCircle2 size={30} strokeWidth={2.5} />
              </div>
              <h3 className="text-[19px] font-black text-slate-900">Заказ оформлен!</h3>
              <p className="mt-1 font-mono text-[15px] font-black text-teal-700">{orderDone.number}</p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
                {orderDone.paymentMethod === "online"
                  ? "Мы отправим ссылку для онлайн-оплаты в SMS. После оплаты статус обновится автоматически."
                  : "Оплата в магазине по адресу Луга, пр. Кирова, 80. Мы позвоним, когда заказ будет готов к выдаче."}
              </p>
              {orderDone.cardAfterPayment && (
                <div className="mt-3 rounded-2xl bg-amber-50 p-3.5 text-left">
                  <p className="flex items-center gap-1.5 text-[13px] font-black text-amber-800">
                    <BadgePercent size={15} className="shrink-0" />
                    Вы получите скидочную карту!
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-700">
                    Заказ от {LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽ — после подтверждения
                    оплаты мы создадим заявку на карту «Водяной», и скидка 5% станет
                    постоянной. Следить за заявкой можно в личном кабинете — вход по номеру
                    телефона.
                  </p>
                  <button
                    onClick={() => {
                      setOrderDone(null);
                      navigate("/account");
                    }}
                    className="mt-2.5 w-full rounded-full bg-white py-2.5 text-[13px] font-black text-teal-700 ring-1 ring-teal-200 transition active:scale-[0.98]"
                  >
                    Открыть личный кабинет
                  </button>
                </div>
              )}
              <button
                onClick={() => setOrderDone(null)}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3 text-[14px] font-black text-white shadow-lg shadow-orange-500/25 active:scale-[0.98]"
              >
                Понятно
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= Checkout: экран выбора способа оплаты ================= */
function CheckoutSheet({
  onClose,
  cart,
  totalSum,
  loyaltyActive,
  instantCard,
  defaultName,
  defaultPhone,
  onSubmit,
}: {
  onClose: () => void;
  cart: CartItem[];
  totalSum: number;
  loyaltyActive: boolean;
  instantCard: boolean;
  defaultName: string;
  defaultPhone: string;
  onSubmit: (data: { name: string; phone: string; comment: string; paymentMethod: PaymentMethod }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [comment, setComment] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("online");
  const [error, setError] = useState("");

  const discountApplies = loyaltyActive || instantCard;
  const discount = discountApplies ? Math.round(totalSum * LOYALTY_DISCOUNT) : 0;
  const total = totalSum - discount;
  const totalCount = cart.reduce((s, i) => s + i.quantity, 0);

  const submit = () => {
    if (!name.trim() || name.trim().length < 2) return setError("Введите имя");
    if (phone.replace(/\D/g, "").length < 10) return setError("Введите корректный телефон");
    setError("");
    onSubmit({ name: name.trim(), phone: phone.trim(), comment: comment.trim(), paymentMethod: payment });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute inset-x-0 bottom-0 z-40 mx-auto flex max-h-[92%] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-black text-slate-800">Оформление заказа</h3>
          <button onClick={onClose} className="ml-auto text-slate-400"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Способ оплаты */}
          <div className="mb-4">
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-400">
              Как хотите оплатить?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPayment("online")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 transition active:scale-95 ${
                  payment === "online"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-500/15"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <CreditCard size={22} />
                <span className="text-[13px] font-black">Картой онлайн</span>
                <span className="text-[10.5px] font-medium">по SMS-ссылке</span>
              </button>
              <button
                onClick={() => setPayment("shop")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 transition active:scale-95 ${
                  payment === "shop"
                    ? "border-sky-500 bg-sky-50 text-sky-700 shadow-md shadow-sky-500/15"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <Store size={22} />
                <span className="text-[13px] font-black">В магазине</span>
                <span className="text-[10.5px] font-medium">при получении</span>
              </button>
            </div>
          </div>

          {/* Данные клиента */}
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Имя</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[14.5px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Телефон</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (___) ___-__-__"
                inputMode="tel"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[14.5px] font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Комментарий <span className="font-medium text-slate-300">(необязательно)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Например: перезвонить после 18:00"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[14px] text-slate-700 outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>
            {error && <p className="text-[12.5px] font-bold text-red-500">{error}</p>}
          </div>

          {/* Итого */}
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center text-[12.5px] text-slate-500">
              <span>Товаров</span>
              <span className="ml-auto font-bold">{totalCount} шт.</span>
            </div>
            <div className="mt-1 flex items-center text-[12.5px] text-slate-500">
              <span>Сумма</span>
              <span className="ml-auto font-bold">{totalSum.toLocaleString("ru-RU")} ₽</span>
            </div>
            {discount > 0 && (
              <>
                <div className="mt-1 flex items-center text-[12.5px] font-bold text-amber-600">
                  <span>
                    {instantCard && !loyaltyActive
                      ? "Скидка −5%: карту вы получите с этим заказом"
                      : "Скидка по карте −5%"}
                  </span>
                  <span className="ml-auto">−{discount.toLocaleString("ru-RU")} ₽</span>
                </div>
                {instantCard && !loyaltyActive && (
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-amber-600/80">
                    Заказ от {LOYALTY_THRESHOLD.toLocaleString("ru-RU")} ₽ — скидочная карта
                    «Водяной» выдаётся сразу с этой покупкой
                  </p>
                )}
              </>
            )}
            <div className="mt-2 flex items-baseline border-t border-slate-200 pt-2">
              <span className="text-[13px] font-bold text-slate-500">Итого</span>
              <span className="ml-auto text-[22px] font-black text-teal-700">
                {total.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button
            onClick={submit}
            className="w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3.5 text-[15px] font-black text-white shadow-lg shadow-orange-500/25 active:scale-[0.98]"
          >
            {payment === "online" ? "Оплатить онлайн" : "Оформить заказ"}
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
            {payment === "online"
              ? "После оплаты статус в личном кабинете обновится на «Оплачен (онлайн)»"
              : "Оплата и получение в магазине: Луга, пр. Кирова, 80"}
          </p>
        </div>
      </motion.div>
    </>
  );
}
