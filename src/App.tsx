import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/lib/useAuth";
import { useEffect } from "react";
import { toast } from "sonner";
import { fetchClientCloudBookings } from "@/lib/cloud-bookings";
import { getBookings, updateBookingStatus, getBathhouseById, saveNotification } from "@/lib/store";
import { getGuestId } from "@/lib/guest";
import Header from "@/components/Header";
import Index from "./pages/Index";
import BathhouseList from "./pages/BathhouseList";
import BathhouseDetail from "./pages/BathhouseDetail";
import Auth from "./pages/Auth";
import ClientDashboard from "./pages/ClientDashboard";
import MyBookings from "./pages/MyBookings";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const AppContent = () => {
  const { user, logout, isImpersonating, returnToAdmin } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sizeKB = ((detail?.size || 0) / 1024).toFixed(0);
      toast.error(`Ошибка сохранения данных (${sizeKB} КБ)`, {
        description: 'Хранилище браузера переполнено. Удалите лишние фото/видео или уменьшите их размер.',
        duration: 10000,
      });
    };
    window.addEventListener('banya-store-error', handler);
    return () => window.removeEventListener('banya-store-error', handler);
  }, []);

  // Global sync: pull latest booking statuses from cloud and notify client when changed
  useEffect(() => {
    const sync = async () => {
      try {
        const ids = new Set<string>();
        ids.add(getGuestId());
        if (user?.id) ids.add(user.id);

        const local = getBookings();
        for (const cid of ids) {
          const cloud = await fetchClientCloudBookings(cid);
          cloud.forEach(cb => {
            const lb = local.find(b => b.id === cb.id);
            if (lb && lb.status !== cb.status && (cb.status === 'confirmed' || cb.status === 'rejected')) {
              updateBookingStatus(cb.id, cb.status);
              const bhName = getBathhouseById(cb.bathhouseId)?.name || '';
              const statusText = cb.status === 'confirmed' ? 'подтверждена ✅' : 'отклонена ❌';
              saveNotification({
                id: crypto.randomUUID(),
                type: cb.status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected',
                message: `Ваша бронь в ${bhName} на ${cb.date} ${cb.startTime}–${cb.endTime} ${statusText}`,
                createdAt: new Date().toISOString(),
                read: false,
                userId: user?.id,
                bookingId: cb.id,
              });
              toast.success(cb.status === 'confirmed' ? 'Бронь подтверждена!' : 'Бронь отклонена', {
                description: `${bhName}, ${cb.date} ${cb.startTime}–${cb.endTime}`,
              });
            }
          });
        }
      } catch (e) {
        // silent
      }
    };
    sync();
    const iv = setInterval(sync, 15000);
    return () => clearInterval(iv);
  }, [user?.id]);

  return (
    <>
      <Header user={user} onLogout={logout} isImpersonating={isImpersonating} onReturnToAdmin={returnToAdmin} />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/bathhouses" element={<BathhouseList />} />
        <Route path="/bathhouse/:id" element={<BathhouseDetail />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/client" element={<ClientDashboard />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
