import QRCode from "qrcode";

export function buildPublicTicketUrl(tokenPublic: string): string {
  return `${window.location.origin}/t/${tokenPublic}`;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}
