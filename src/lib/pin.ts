export const PIN_LENGTH = 4;

export function appendDigit(pin: string, digit: string): string {
  if (!/^[0-9]$/.test(digit)) return pin;
  if (pin.length >= PIN_LENGTH) return pin;
  return pin + digit;
}

export function removeLastDigit(pin: string): string {
  return pin.slice(0, -1);
}

export function isPinComplete(pin: string): boolean {
  return pin.length === PIN_LENGTH;
}
