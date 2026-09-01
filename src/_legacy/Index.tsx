import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBathhouses } from '@/lib/store';
import { subscribeToStoreUpdates } from '@/lib/store-events';
import { Bathhouse } from '@/lib/types';
import BathhouseCard from '@/components/BathhouseCard';
import { Button } from '@/components/ui/button';
import { Flame, Search, Calendar, Shield } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';

const Index = () => {
  const [bathhouses, setBathhouses] = useState<Bathhouse[]>([]);

  useEffect(() => {
    const refreshBathhouses = () => setBathhouses(getBathhouses());
    refreshBathhouses();
    return subscribeToStoreUpdates(refreshBathhouses);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent to-background py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Flame className="h-4 w-4" />
              Zabron — онлайн-бронирование
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Бронируйте лучшие места <span className="text-primary">за пару кликов</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Спа и бани, рестораны, развлечения и зоны отдыха — всё в одном месте.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/bathhouses">
                <Button size="lg" className="gap-2">
                  <Search className="h-4 w-4" />
                  Найти заведение
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Для владельцев</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold">Разделы</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/bathhouses?category=${c.id}`}
                  className="group rounded-xl border bg-card p-6 text-center space-y-3 transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold">{c.label}</h3>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: Search, title: 'Выбирайте', desc: 'Просматривайте каталог бань с фото, ценами и описаниями' },
              { icon: Calendar, title: 'Бронируйте', desc: 'Выбирайте удобную дату и время в интерактивном календаре' },
              { icon: Shield, title: 'Отдыхайте', desc: 'Получите подтверждение и наслаждайтесь отдыхом' },
            ].map(f => (
              <div key={f.title} className="rounded-xl border bg-card p-6 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Популярные заведения</h2>
            <Link to="/bathhouses">
              <Button variant="ghost">Смотреть все →</Button>
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bathhouses.slice(0, 3).map(b => (
              <BathhouseCard key={b.id} bathhouse={b} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
