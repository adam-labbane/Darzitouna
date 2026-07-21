export type ModeReglement = "ESPECES" | "HUILE" | "VIREMENT";

export interface Reglement {
  id: string;
  facture_id: string;
  date_reglement: string;
  montant: number;
  mode: ModeReglement;
  note: string | null;
}
