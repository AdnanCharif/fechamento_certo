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

export function maskCnpj(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
