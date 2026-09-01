import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBathhouses } from '@/lib/store';
import { subscribeToStoreUpdates } from '@/lib/store-events';
import { geocodeBathhouses } from '@/lib/geocode';
import { Bathhouse, VenueCategory } from '@/lib/types';
import { CATEGORIES, getCategory } from '@/lib/categories';
import BathhouseCard from '@/components/BathhouseCard';
import BathhouseMap from '@/components/BathhouseMap';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 18;

const BathhouseList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = (searchParams.get('category') as VenueCategory | null) || null;
  const [bathhouses, setBathhouses] = useState<Bathhouse[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refreshBathhouses = () => {
      const bhs = getBathhouses();
      setBathhouses(bhs);
      geocodeBathhouses(bhs, (updated) => {
        setBathhouses(updated);
      });
    };

    refreshBathhouses();
    return subscribeToStoreUpdates(refreshBathhouses);
  }, []);

  useEffect(() => { setPage(1); }, [search, categoryParam]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    let list = bathhouses;
    if (categoryParam) {
      const cat: VenueCategory = categoryParam === 'spa' ? 'spa' : categoryParam;
      list = list.filter(b => (b.category || 'spa') === cat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bathhouses, search, categoryParam]);

  const suggestions = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    return filtered.slice(0, 8);
  }, [filtered, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(0, page * PAGE_SIZE);

  const setCategory = (cat: VenueCategory | null) => {
    const next = new URLSearchParams(searchParams);
    if (cat) next.set('category', cat);
    else next.delete('category');
    setSearchParams(next);
  };

  const activeCat = getCategory(categoryParam || undefined);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">
        {activeCat ? activeCat.label : 'Каталог заведений'}
      </h1>
      <p className="mb-6 text-muted-foreground">{filtered.length} заведений</p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!categoryParam ? 'default' : 'outline'}
          onClick={() => setCategory(null)}
        >
          Все
        </Button>
        {CATEGORIES.map(c => {
          const Icon = c.icon;
          return (
            <Button
              key={c.id}
              size="sm"
              variant={categoryParam === c.id ? 'default' : 'outline'}
              onClick={() => setCategory(c.id)}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {c.short}
            </Button>
          );
        })}
      </div>

      <div className="relative mb-6 z-[1000]" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          placeholder="Поиск по названию или адресу..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          className="pl-10"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden">
            {suggestions.map(b => (
              <Link
                key={b.id}
                to={`/bathhouse/${b.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
                onClick={() => setShowSuggestions(false)}
              >
                <div className="h-10 w-10 rounded-md overflow-hidden shrink-0 bg-muted">
                  <img
                    src={b.photos[0] || '/placeholder.svg'}
                    alt={b.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {b.address}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BathhouseMap
        bathhouses={filtered.filter(b => b.lat && b.lng)}
        selectedId={selectedId}
        onMarkerClick={setSelectedId}
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {paged.map(b => (
          <div
            key={b.id}
            className={`rounded-xl transition-all ${selectedId === b.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedId(selectedId === b.id ? null : b.id)}
          >
            <BathhouseCard bathhouse={b} />
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            Ничего не найдено
          </p>
        )}
      </div>

      {page < totalPages && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => setPage(p => p + 1)}>
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
};

export default BathhouseList;
