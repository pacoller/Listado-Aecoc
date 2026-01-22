
/**
 * Interfaz que representa los 19 campos exactos de la Hoja 1 (A-S).
 */
export interface InventoryItem {
  "Ubicación de picking": string;
  "Cambiar pick": string | number;
  "Filtrar": string;
  "Colocar": string | number;
  "Artículo": string | number;
  "Descripción": string;
  "P.p. caj.": number | string;
  "P.p. ud.": number | string;
  "Disp. caj.": number | string;
  "Disp. ud.": number | string;
  "Stock Atarfe": number | string;
  "Un/Caja": number | string;
  "Un/Pallet": number | string;
  "Peso caj.": number | string;
  "Dias Vida Util Almacen": number | string;
  "Aecoc": string | number;
  "Tipo": string;
  "Estado del producto": string;
  "Codigo de Promocion": string;
}

export interface AppState {
  data: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  activeTab: 'dashboard' | 'aecoc';
}
