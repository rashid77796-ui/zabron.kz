'use client'

import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Phone, Mail, Globe, Instagram, MessageCircle, Link as LinkIcon } from 'lucide-react';

interface BhContactForm {
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  whatsapp?: string;
  link?: string;
}

interface Props {
  values: BhContactForm;
  onChange: (field: keyof BhContactForm, value: string) => void;
}

const BathhouseContactFields = ({ values, onChange }: Props) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">Контакты и ссылки</Label>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Телефон</Label>
        <PhoneInput value={values.phone || ''} onChange={v => onChange('phone', v)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
        <Input type="email" placeholder="info@example.com" value={values.email || ''} onChange={e => onChange('email', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />Веб-сайт</Label>
        <Input type="url" placeholder="https://example.com" value={values.website || ''} onChange={e => onChange('website', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Instagram className="h-3 w-3" />Instagram</Label>
        <Input placeholder="@username" value={values.instagram || ''} onChange={e => onChange('instagram', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</Label>
        <PhoneInput value={values.whatsapp || ''} onChange={v => onChange('whatsapp', v)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1"><LinkIcon className="h-3 w-3" />Ссылка</Label>
        <Input type="url" placeholder="https://..." value={values.link || ''} onChange={e => onChange('link', e.target.value)} />
      </div>
    </div>
  </div>
);

export default BathhouseContactFields;
