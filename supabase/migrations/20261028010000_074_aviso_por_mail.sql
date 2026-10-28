-- Avisos por mail (Gmail API). Cada tipo de aviso configurable elige su canal:
-- whatsapp (como hasta ahora) o email. El canal de cada aviso queda en la cola.
-- El de estado ("Notificar" al cambiar el estado) y el posventa siguen por
-- WhatsApp: no tienen canal configurable.

alter table public.negocio_seguimiento
  add column if not exists canal text not null default 'whatsapp';
alter table public.negocio_seguimiento
  add constraint negocio_seguimiento_canal_check check (canal in ('whatsapp', 'email'));

alter table public.seguimiento_whatsapp
  add column if not exists canal text not null default 'whatsapp',
  add column if not exists email text,
  alter column telefono drop not null;

alter table public.seguimiento_whatsapp drop constraint seguimiento_whatsapp_telefono_check;
alter table public.seguimiento_whatsapp add constraint seguimiento_whatsapp_destino_check check (
  (canal = 'whatsapp' and email is null and telefono ~ '^[1-9][0-9]{7,14}$')
  or (canal = 'email' and telefono is null and email ~ '^[^[:space:]<>,;"]+@[^[:space:]<>,;"]+$')
);
