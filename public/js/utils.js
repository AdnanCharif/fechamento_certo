// Funções utilitárias de DOM e formatação.
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const signedMoney = (value) => `${Number(value) > 0 ? '+' : ''}${money(value)}`;
export const todayPt = () => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
export const sameId = (a, b) => String(a ?? '') === String(b ?? '');

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && day ? `${day}/${month}/${year}` : value;
}

// "AAAA-MM-DD" -> "29 de agosto" (sem fuso: a data já é local).
export function longDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

// "AAAA-MM" -> "Mai"
export function monthShort(value) {
  const [year, month] = String(value).split('-').map(Number);
  const name = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// "Hoje, 14:32", "Ontem, 18:02" ou "10 out, 09:22".
export function shortDateTime(value) {
  const date = new Date(value);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `Hoje, ${time}`;
  if (days === 1) return `Ontem, ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')}, ${time}`;
}

export function timeAgo(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Agora há pouco';
  if (minutes < 60) return `Há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
  const days = Math.round(hours / 24);
  return `Há ${days} dia${days > 1 ? 's' : ''}`;
}

const digits = (value, max) => value.replace(/\D/g, '').slice(0, max);

export function maskCnpj(value) {
  return digits(value, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

export const maskCep = (value) => digits(value, 8).replace(/^(\d{5})(\d)/, '$1-$2');

// Fixo "(11) 3456-7890" ou celular "(11) 98765-4321".
export function maskPhone(value) {
  const number = digits(value, 11);
  if (number.length <= 2) return number.replace(/^(\d+)/, '($1');
  const split = number.length === 11 ? 7 : 6;
  return `(${number.slice(0, 2)}) ${number.slice(2, split)}${number.length > split ? `-${number.slice(split)}` : ''}`;
}

// Celular brasileiro com DDD: 11 dígitos e o primeiro do número é 9 (formato aceito pelo WhatsApp).
export const isMobilePhone = (value) => /^\d{2}9\d{8}$/.test(String(value ?? '').replace(/\D/g, ''));

// Máscaras aplicadas a campos com data-mask (ver router.js).
export const masks = { cnpj: maskCnpj, cep: maskCep, phone: maskPhone };
