import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { anonymous } from 'better-auth/plugins'
import { prisma } from '@/server/db/client'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM ?? 'Zabron <noreply@maguya.kz>'
const BASE_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

// Серверная проверка сложности пароля — защита от обхода клиентской валидации (правка #9).
const PASSWORD_PATHS = ['/sign-up/email', '/reset-password', '/change-password']
function isStrongPassword(pw: string) {
  return pw.length >= 8 && pw.length <= 128 && /\p{L}/u.test(pw) && /\d/.test(pw)
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
          if (!resend) return

          await resend.emails.send({
              from: FROM,
              to: user.email,
              subject: 'Подтвердите email — Zabron',
              html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111">
<h2 style="color:#7101F1">Подтвердите ваш email</h2>
<p>Нажмите на кнопку ниже чтобы подтвердить адрес и начать пользоваться Zabron.</p>
<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7101F1;color:#fff;border-radius:8px;text-decoration:none">Подтвердить email</a>
<p style="margin-top:24px;font-size:13px;color:#666">Ссылка действительна 24 часа. Если вы не регистрировались — проигнорируйте это письмо.</p>
</body></html>`,
          })
      },
  },

  emailAndPassword: {
    enabled: true,
    // Разрешаем вход без подтверждения почты: неподтверждённые пользователи
    // получают сессию, но доступ к функционалу ограничен gate-экраном на клиенте.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) return
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: 'Сброс пароля — Zabron',
        html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111">
<h2 style="color:#7101F1">Сброс пароля</h2>
<p>Нажмите на кнопку ниже чтобы задать новый пароль.</p>
<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7101F1;color:#fff;border-radius:8px;text-decoration:none">Сбросить пароль</a>
<p style="margin-top:24px;font-size:13px;color:#666">Ссылка действительна 1 час.</p>
</body></html>`,
      })
    },
  },

  ...(process.env.GOOGLE_CLIENT_ID ? {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  } : {}),

  plugins: [
    anonymous({
      // Гостю выдаётся служебный email вида <id>@anon.zabron.kz — колонка
      // email уникальна и NOT NULL, поэтому домен нужен обязательно.
      emailDomainName: 'anon.zabron.kz',

      /**
       * Гость зарегистрировался или вошёл: переносим на постоянный аккаунт всё,
       * что он успел накопить. Плагин удаляет анонимную запись сразу после
       * этого коллбэка, а на User ссылаются брони, отзывы, избранное и
       * уведомления — не перенесёшь, и удаление упадёт на внешнем ключе.
       */
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const fromId = anonymousUser.user.id
        const toId = newUser.user.id
        if (fromId === toId) return

        await prisma.$transaction(async tx => {
          await tx.booking.updateMany({ where: { clientUserId: fromId }, data: { clientUserId: toId } })
          await tx.review.updateMany({ where: { clientUserId: fromId }, data: { clientUserId: toId } })
          await tx.waitlistEntry.updateMany({ where: { clientUserId: fromId }, data: { clientUserId: toId } })
          await tx.notification.updateMany({ where: { userId: fromId }, data: { userId: toId } })

          // Favorite уникален по паре (clientUserId, venueId): переносим только
          // те заведения, которых у постоянного аккаунта ещё нет, остальные
          // просто удаляем — иначе updateMany упрётся в unique-констрейнт.
          const existing = await tx.favorite.findMany({
            where: { clientUserId: toId },
            select: { venueId: true },
          })
          const alreadySaved = existing.map(f => f.venueId)
          await tx.favorite.updateMany({
            where: { clientUserId: fromId, venueId: { notIn: alreadySaved } },
            data: { clientUserId: toId },
          })
          await tx.favorite.deleteMany({ where: { clientUserId: fromId } })
        })
      },
    }),
  ],

  hooks: {
    // До обработки регистрации/сброса/смены пароля проверяем сложность (правка #9).
    before: createAuthMiddleware(async (ctx) => {
      if (PASSWORD_PATHS.includes(ctx.path)) {
        const body = ctx.body as { password?: unknown; newPassword?: unknown } | undefined
        const pw = typeof body?.password === 'string'
          ? body.password
          : typeof body?.newPassword === 'string'
          ? body.newPassword
          : undefined
        if (typeof pw === 'string' && !isStrongPassword(pw)) {
          throw new APIError('BAD_REQUEST', {
            message: 'Пароль должен быть от 8 до 128 символов и содержать буквы и цифры',
          })
        }
      }
    }),
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  user: {
    additionalFields: {
      phone: { type: 'string', required: false, input: true, defaultValue: '' },
      role: { type: 'string', required: false, input: true, defaultValue: 'client' },
      link: { type: 'string', required: false, input: true, defaultValue: '' },
      locale: { type: 'string', required: false, input: false, defaultValue: 'ru' },
      noShowCount: { type: 'number', required: false, input: false, defaultValue: 0 },
      isPhoneVerified: { type: 'boolean', required: false, input: false, defaultValue: false },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type BetterAuthUser = typeof auth.$Infer.Session.user
