/** wa.me link: to a number when we have one, otherwise WhatsApp asks whom to send it to. */
export function whatsappLink(text: string, phone?: string) {
  let digits = (phone ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
