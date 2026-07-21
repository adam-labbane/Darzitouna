import { appendDigit, removeLastDigit, PIN_LENGTH } from "../lib/pin";

interface PinKeypadProps {
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
  shake?: boolean;
  label?: string;
}

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

const KEYPAD_BUTTON_BASE =
  "w-16 h-16 rounded-2xl flex items-center justify-center font-bold select-none " +
  "bg-white border-2 border-gray-200 text-[#1B4332] " +
  "transition-transform duration-100 active:scale-95 active:bg-green-50 active:border-[#2D6A4F] " +
  "disabled:opacity-40 disabled:pointer-events-none";

export default function PinKeypad({
  value,
  onChange,
  disabled = false,
  shake = false,
  label = "Code PIN",
}: PinKeypadProps) {
  const handleDigit = (digit: string) => {
    if (disabled) return;
    onChange(appendDigit(value, digit));
  };

  const handleBackspace = () => {
    if (disabled) return;
    onChange(removeLastDigit(value));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
  };

  return (
    <div className={`flex flex-col items-center gap-6 ${shake ? "animate-shake" : ""}`}>
      <div
        className="flex gap-4"
        role="status"
        aria-label={`${value.length} chiffres saisis sur ${PIN_LENGTH}`}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < value.length
                ? "bg-[#2D6A4F] border-[#2D6A4F] scale-110"
                : "bg-transparent border-gray-300"
            }`}
          />
        ))}
      </div>

      <div role="group" aria-label={label} className="grid grid-cols-3 gap-4">
        {DIGIT_ROWS.flat().map((digit) => (
          <button
            key={digit}
            type="button"
            aria-label={`Chiffre ${digit}`}
            disabled={disabled}
            onClick={() => handleDigit(digit)}
            className={`${KEYPAD_BUTTON_BASE} text-[28px]`}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          aria-label="Effacer le dernier chiffre"
          disabled={disabled || value.length === 0}
          onClick={handleBackspace}
          className={`${KEYPAD_BUTTON_BASE} text-2xl`}
        >
          ⌫
        </button>

        <button
          type="button"
          aria-label="Chiffre 0"
          disabled={disabled}
          onClick={() => handleDigit("0")}
          className={`${KEYPAD_BUTTON_BASE} text-[28px]`}
        >
          0
        </button>

        <button
          type="button"
          aria-label="Effacer tout le code"
          disabled={disabled || value.length === 0}
          onClick={handleClear}
          className={`${KEYPAD_BUTTON_BASE} text-sm`}
        >
          Tout
          <br />
          effacer
        </button>
      </div>
    </div>
  );
}
