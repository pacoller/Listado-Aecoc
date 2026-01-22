
/**
 * BACKEND: Google Apps Script
 * Optimizado para consulta rápida de grandes volúmenes de datos.
 */

// URL del documento proporcionada por el usuario
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xycsCObrwx_m2nvwLpFMA6g5KhldWPUTJ4FrCdIKoBA/edit?usp=sharing';

/**
 * Sirve la interfaz de usuario al cargar la URL de la Web App.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('SG-I | Gestión de Inventario AECOC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Obtiene los datos de la Hoja 1, empezando en la fila 5.
 * Chain-of-Verification:
 * 1. Acceso por índice [0] (Hoja 1).
 * 2. Rango fijo A5:S (19 columnas).
 * 3. Conversión a objetos JSON para máxima velocidad en el cliente.
 */
function getInventoryData() {
  try {
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    // Accedemos a la primera pestaña (Hoja 1)
    const sheet = ss.getSheets()[0]; 
    
    if (!sheet) throw new Error("No se pudo acceder a la Hoja 1.");

    const lastRow = sheet.getLastRow();
    // Si no hay datos después de la cabecera en fila 5, devolvemos vacío
    if (lastRow < 5) return [];

    // Rango: Fila 5, Columna 1 (A), hasta última fila, 19 columnas (hasta S)
    const numRows = lastRow - 4;
    const numCols = 19;
    const values = sheet.getRange(5, 1, numRows, numCols).getValues();
    
    // La primera fila del rango es nuestra cabecera (Fila 5 del sheet)
    const headers = values[0];
    const dataRows = values.slice(1);

    // Mapeo a JSON: Los nombres de las columnas se limpian de espacios
    return dataRows.map(row => {
      const item = {};
      headers.forEach((header, index) => {
        const key = header ? header.toString().trim() : `Columna_${index + 1}`;
        item[key] = row[index];
      });
      return item;
    });

  } catch (error) {
    console.error("Error en servidor: " + error.message);
    throw new Error("Fallo en base de datos: " + error.message);
  }
}
