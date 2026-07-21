// src/components/SearchableSelect.tsx
//
// Sélecteur générique avec recherche, pattern ARIA combobox — remplace
// la recherche + liste de boutons dupliquée dans DepotNouveau.tsx
// (étape 1) et FactureCreationModal.tsx. La recherche réseau (debounce +
// fetch) reste dans la page appelante, comme avant : ce composant ne
// gère que l'affichage/interaction (query/results/selected sont
// contrôlés par le parent), un seul endroit à faire évoluer pour toute
// sélection de client, jamais dupliqué.
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { moveActiveIndex } from "../lib/searchableSelect";

interface SearchableSelectProps<T> {
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  results: T[];
  selected: T | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  placeholder?: string;
  emptyMessage?: string;
}

export default function SearchableSelect<T>({
  label,
  query,
  onQueryChange,
  results,
  selected,
  onSelect,
  onClear,
  getId,
  getLabel,
  getSubLabel,
  placeholder = "Rechercher…",
  emptyMessage = "Aucun résultat",
}: SearchableSelectProps<T>) {
  const inputId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const optionDomId = (item: T) => `${listboxId}-option-${getId(item)}`;
  const showListbox = open && !selected && (results.length > 0 || query.trim() !== "");

  const closeList = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    closeList();
  };

  const handleChange = (value: string) => {
    if (selected) onClear();
    onQueryChange(value);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => moveActiveIndex(index, results.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
    }
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-600 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showListbox && activeIndex >= 0 && results[activeIndex] ? optionDomId(results[activeIndex]) : undefined
          }
          autoComplete="off"
          value={selected ? getLabel(selected) : query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (!selected) setOpen(true);
          }}
          onBlur={closeList}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full h-[52px] px-4 border-2 rounded-xl focus:outline-none transition-colors motion-reduce:transition-none ${
            selected
              ? "border-brand bg-brand-tint text-brand-dark font-semibold pr-12"
              : "border-gray-200 focus:border-brand"
          }`}
        />
        {selected && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Effacer la sélection"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-brand-dark hover:bg-white/60"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {showListbox && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border-2 border-gray-200 rounded-xl shadow-soft py-1"
        >
          {results.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">{emptyMessage}</li>}
          {results.map((item, index) => (
            <li
              key={getId(item)}
              id={optionDomId(item)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => handleSelect(item)}
              className={`mx-1 px-3 py-2 rounded-lg cursor-pointer min-h-[48px] flex flex-col justify-center ${
                index === activeIndex ? "bg-brand-tint" : ""
              }`}
            >
              <span className="font-semibold text-gray-900">{getLabel(item)}</span>
              {getSubLabel && <span className="text-sm text-gray-500">{getSubLabel(item)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
