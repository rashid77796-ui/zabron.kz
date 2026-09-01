import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata = { title: 'Условия использования — Zabron' }

// Страница оферты / Условий использования (правка #10).
// ВАЖНО: юридический текст — заглушка «на согласовании». Финальную редакцию
// предоставляет владелец/юрист, не выдумываем обязывающие условия.
export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <Link href="/" className="mb-6 flex items-center" aria-label="Zabron">
          <Logo variant="wordmark" className="h-6 w-auto" />
        </Link>
        <h1 className="text-3xl font-bold mb-2">Условия использования</h1>
        <p className="text-muted-foreground text-sm">Дата вступления в силу: на согласовании</p>
      </div>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        ⚠️ Черновик. Юридический текст публичной оферты на согласовании — окончательную редакцию предоставляет владелец / юрист.
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Общие положения</h2>
          <p>Настоящие Условия использования (публичная оферта) регулируют отношения между платформой Zabron (оператор — ТОО «Zabron», Республика Казахстан) и пользователями. Используя Платформу, вы принимаете настоящие Условия.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">2. Предмет</h2>
          <p>Платформа предоставляет сервис онлайн-бронирования мест в заведениях. Zabron выступает технологическим посредником между пользователями и заведениями и не оказывает сами услуги отдыха.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">3. Бронирование и оплата</h2>
          <p>Заявка на бронирование подтверждается заведением. Оплата услуг производится в заведении, если не указано иное. <em>[Раздел на согласовании: условия оплаты, депозита.]</em></p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">4. Отмена и возврат</h2>
          <p><em>[Текст на согласовании: правила отмены брони, сроки, ответственность сторон.]</em></p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">5. Обязанности пользователя</h2>
          <p><em>[Текст на согласовании.]</em></p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">6. Ответственность и ограничения</h2>
          <p><em>[Текст на согласовании.]</em></p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">7. Персональные данные</h2>
          <p>Обработка персональных данных регулируется <Link href="/privacy" className="text-primary underline">Политикой конфиденциальности</Link>.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">8. Изменения условий</h2>
          <p>Оператор вправе изменять настоящие Условия; актуальная редакция публикуется на этой странице.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">9. Контакты</h2>
          <p>ТОО «Zabron», Республика Казахстан. Email: <a href="mailto:info@zabron.kz" className="text-primary underline">info@zabron.kz</a></p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">← На главную</Link>
      </div>
    </div>
  )
}
