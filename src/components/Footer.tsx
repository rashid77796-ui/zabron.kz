'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '@/components/Logo'
import { api, type ApiCategory } from '@/lib/api'
import { sortCategories } from '@/lib/categories'
import { useI18n } from '@/lib/i18n'

/**
 * Подвал сайта — ДЕСКТОПНАЯ и планшетная раскладка (по образцу kino.kz):
 * колонка бренда + колонки ссылок, снизу полоса с копирайтом.
 *
 * Только `≥ sm`: на мобильных внизу экрана живёт [[BottomNav]], и подвал под
 * ним оказался бы недосягаем. Тот же брейкпоинт, что у нижней навигации и
 * ленты категорий, — граница «мобильный / не-мобильный» в проекте одна.
 */
export function Footer() {
  const { t } = useI18n()

  // Тот же queryKey, что у ленты категорий, — попадаем в её кэш без лишнего запроса.
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
    staleTime: 5 * 60_000,
  })

  return (
    <footer className="hidden border-t bg-card sm:block">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center" aria-label="Zabron">
              <Logo variant="wordmark" className="h-7 w-auto" />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.tagline}</p>
          </div>

          <FooterColumn title={t.footer.aboutTitle}>
            <FooterLink href="/terms">{t.footer.terms}</FooterLink>
            <FooterLink href="/privacy">{t.footer.privacy}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.categoriesTitle}>
            <FooterLink href="/venues">{t.footer.allVenues}</FooterLink>
            {sortCategories(categories ?? []).map((cat: ApiCategory) => (
              <FooterLink key={cat.slug} href={`/venues?category=${cat.slug}`}>
                {cat.nameRu}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title={t.footer.partnersTitle}>
            <FooterLink href="/auth">{t.footer.becomePartner}</FooterLink>
            <FooterLink href="/owner">{t.footer.partnerCabinet}</FooterLink>
            <li className="pt-2 text-sm font-medium text-foreground">{t.footer.contactsTitle}</li>
            <li>
              <a
                href="mailto:info@zabron.kz"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                info@zabron.kz
              </a>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-8 border-t pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} ТОО «Zabron». {t.footer.rights}.
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  )
}
