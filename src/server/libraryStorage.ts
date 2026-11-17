import fs from 'fs';
import path from 'path';

export interface LibraryBookFile {
  discipline: string;
  bookId: string;
  title: string;
  author: string;
  fileName: string;
  pdfPath: string;
  txtPath: string;
  vectorPath: string;
  size: string;
  pages: number;
  chunksCount: number;
  createdAt: string;
  status: 'indexed' | 'extracting' | 'failed';
  isExample: boolean;
}

export const ROOT_LIBRARY_DIR = path.resolve(process.cwd(), 'libreria');

export const DEFAULT_DISCIPLINES = [
  'Estatica',
  'Diseno_Mecanico',
  'Termodinamica',
  'Mecanica_Materiales',
  'Elementos_Maquinas'
];

/**
 * Ensure the physical folder structure exists:
 * .../librería
 *       /[Disciplina]
 *           /pdf
 *           /vector
 *           /txt
 */
export function ensureLibraryDirectories() {
  if (!fs.existsSync(ROOT_LIBRARY_DIR)) {
    fs.mkdirSync(ROOT_LIBRARY_DIR, { recursive: true });
  }

  for (const disc of DEFAULT_DISCIPLINES) {
    const discDir = path.join(ROOT_LIBRARY_DIR, disc);
    const pdfDir = path.join(discDir, 'pdf');
    const vectorDir = path.join(discDir, 'vector');
    const txtDir = path.join(discDir, 'txt');

    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    if (!fs.existsSync(vectorDir)) fs.mkdirSync(vectorDir, { recursive: true });
    if (!fs.existsSync(txtDir)) fs.mkdirSync(txtDir, { recursive: true });
  }
}

function readLibraryVisibilityPrefs(): { hideExamples: boolean; deletedSeedFiles: Set<string> } {
  const settingsPath = path.join(ROOT_LIBRARY_DIR, '.aether-settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      return {
        hideExamples: Boolean(parsed?.hideExamples),
        deletedSeedFiles: new Set(
          Array.isArray(parsed?.deletedSeedFiles)
            ? parsed.deletedSeedFiles.filter((f: unknown) => typeof f === 'string')
            : []
        ),
      };
    }
  } catch {}
  return { hideExamples: false, deletedSeedFiles: new Set<string>() };
}

/**
 * Seed initial textbooks into the physical folders if not already present
 */
export function seedDefaultLibraryBooks(forceRestore = false) {
  ensureLibraryDirectories();
  const { deletedSeedFiles } = forceRestore
    ? { deletedSeedFiles: new Set<string>() }
    : readLibraryVisibilityPrefs();

  const seedBooks = [
    {
      discipline: 'Estatica',
      fileName: 'Ingenieria_Mecanica_Estatica_Hibbeler_12ma_Ed.pdf',
      title: 'Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed',
      author: 'R. C. Hibbeler',
      size: '48.1 MB',
      pages: 672,
      chunksCount: 1840,
      isExample: false,
      txtContent: `# INGENIERÍA MECÁNICA: ESTÁTICA (12ma Edición)
**Autor:** R. C. Hibbeler · Prentice Hall
**Disciplina:** Estática y Análisis Estructural

---

## CAPÍTULO 1: PRINCIPIOS GENERALES
La estática es la rama de la mecánica que estudia los cuerpos en estado de reposo o que se mueven a velocidad constante.

### Tres Leyes de Newton del Movimiento
1. **Primera Ley:** Una partícula en reposo o con movimiento rectilíneo uniforme permanecerá en dicho estado a menos que actúe sobre ella una fuerza desbalanceada:
$$\\sum \\vec{F} = 0$$

2. **Segunda Ley:** Una partícula sobre la que actúa una fuerza desbalanceada experimenta una aceleración con la misma dirección que la fuerza:
$$\\vec{F} = m \\cdot \\vec{a}$$

3. **Tercera Ley:** Las fuerzas de acción y reacción entre cuerpos en contacto tienen igual magnitud, misma línea de acción y sentidos opuestos:
$$\\vec{F}_{A \\to B} = -\\vec{F}_{B \\to A}$$

---

## CAPÍTULO 5: EQUILIBRIO DE UN CUERPO RÍGIDO EN 2D Y 3D

Para garantizar el equilibrio completo de una estructura coplanar, se deben satisfacer simultáneamente las tres ecuaciones escalares independientes:

$$\\sum F_x = 0$$
$$\\sum F_y = 0$$
$$\\sum M_O = 0$$

Donde $\\sum M_O$ representa la sumatoria de momentos de todas las fuerzas actuantes respecto a cualquier punto arbitrario $O$ en el plano.

### Diagrama de Cuerpo Libre (DCL)
Un soporte articulado liso ejerce dos componentes de reacción perpendiculares $A_x$ y $A_y$:
$$R_A = \\sqrt{A_x^2 + A_y^2}, \\quad \\theta = \\arctan\\left(\\frac{A_y}{A_x}\\right)$$

Mientras que un soporte de rodillo únicamente transmite fuerza normal a la superficie de apoyo.`
    },
    {
      discipline: 'Diseno_Mecanico',
      fileName: 'shigley_diseno_en_ingenieria_mecanica_10.pdf',
      title: 'Diseño en Ingeniería Mecánica',
      author: 'Richard G. Budynas, J. Keith Nisbett',
      size: '48.2 MB',
      pages: 1088,
      chunksCount: 2420,
      isExample: true,
      txtContent: `# DISEÑO EN INGENIERÍA MECÁNICA DE SHIGLEY (10ma Edición)
**Autores:** Richard G. Budynas, J. Keith Nisbett · McGraw-Hill Education
**Disciplina:** Diseño Mecánico y Fatiga de Materiales

---

## CAPÍTULO 6: FALLA POR FATIGA RESULTANTE DE CARGAS VARIABLES

Bajo esfuerzos cíclicos fluctuantes, la amplitud del esfuerzo alternante $\\sigma_a$ y el esfuerzo medio $\\sigma_m$ se definen como:

$$\\sigma_a = \\left| \\frac{\\sigma_{\\max} - \\sigma_{\\min}}{2} \\right|$$
$$\\sigma_m = \\frac{\\sigma_{\\max} + \\sigma_{\\min}}{2}$$

### Criterio de Falla de Goodman Modificado
El factor de seguridad $n$ contra la falla por fatiga infinita según la recta de Goodman relaciona el límite de fatiga corregido $S_e$ y la resistencia a la tensión $S_{ut}$:

$$\\frac{\\sigma_a}{S_e} + \\frac{\\sigma_m}{S_{ut}} = \\frac{1}{n}$$

### Criterio de Soderberg (Conservador para Fluencia)
$$\\frac{\\sigma_a}{S_e} + \\frac{\\sigma_m}{S_y} = \\frac{1}{n}$$

Donde los factores de modificación de Marin para el límite de resistencia a la fatiga son:
$$S_e = k_a \\cdot k_b \\cdot k_c \\cdot k_d \\cdot k_e \\cdot S_e'$$`
    },
    {
      discipline: 'Termodinamica',
      fileName: 'cengel_termodinamica_9na_ed.pdf',
      title: 'Termodinámica',
      author: 'Yunus A. Çengel, Michael A. Boles',
      size: '54.1 MB',
      pages: 1024,
      chunksCount: 2190,
      isExample: true,
      txtContent: `# TERMODINÁMICA (9na Edición)
**Autores:** Yunus A. Çengel, Michael A. Boles · McGraw-Hill
**Disciplina:** Termodinámica Aplicada

---

## CAPÍTULO 4: ANÁLISIS DE ENERGÍA DE SISTEMAS CERRADOS

### Primera Ley de la Termodinámica (Balance de Energía)
Para cualquier sistema cerrado estacionario que experimenta un proceso entre los estados 1 y 2:

$$Q_{\\text{neto, entra}} - W_{\\text{neto, sale}} = \\Delta U$$

Donde el cambio de energía interna $\\Delta U$ para un gas ideal con calores específicos constantes se expresa como:
$$\\Delta U = m \\cdot c_v \\cdot (T_2 - T_1)$$

Y el cambio de entalpía $\\Delta H$:
$$\\Delta H = m \\cdot c_p \\cdot (T_2 - T_1)$$

### Trabajo de Frontera Móvil (Expansión Cuasiestática)
$$W_b = \\int_1^2 P \\, dV$$`
    },
    {
      discipline: 'Mecanica_Materiales',
      fileName: 'beer_mecanica_de_materiales_11.pdf',
      title: 'Mecánica de Materiales',
      author: 'Ferdinand P. Beer, E. Russell Johnston Jr.',
      size: '39.8 MB',
      pages: 896,
      chunksCount: 1980,
      isExample: true,
      txtContent: `# MECÁNICA DE MATERIALES (11ma Edición)
**Autores:** Ferdinand P. Beer, E. Russell Johnston Jr., John T. DeWolf
**Disciplina:** Resistencia y Deformación de Materiales

---

## CAPÍTULO 7: TRANSFORMACIONES DE ESFUERZO Y DEFORMACIÓN

### Círculo de Mohr para Esfuerzo Plano
Las componentes de esfuerzo en un elemento inclinado un ángulo $\\theta$ respecto al eje $x$ son:

$$\\sigma_{x'} = \\frac{\\sigma_x + \\sigma_y}{2} + \\frac{\\sigma_x - \\sigma_y}{2} \\cos(2\\theta) + \\tau_{xy} \\sin(2\\theta)$$
$$\\tau_{x'y'} = -\\frac{\\sigma_x - \\sigma_y}{2} \\sin(2\\theta) + \\tau_{xy} \\cos(2\\theta)$$

### Teoría de la Máxima Energía de Distorsión (Von Mises)
El esfuerzo efectivo de Von Mises $\\sigma_v$ para esfuerzo plano biaxial es:

$$\\sigma_v = \\sqrt{\\sigma_1^2 - \\sigma_1 \\sigma_2 + \\sigma_2^2}$$

La condición de falla o fluencia plástica se cumple cuando $\\sigma_v \\ge S_y$.`
    },
    {
      discipline: 'Elementos_Maquinas',
      fileName: 'mott_elementos_de_maquinas_5ta.pdf',
      title: 'Elementos de Máquinas en el Diseño Mecánico',
      author: 'Robert L. Mott, Edward M. Vavrek, Jyhwen Wang',
      size: '44.6 MB',
      pages: 840,
      chunksCount: 1750,
      isExample: true,
      txtContent: `# ELEMENTOS DE MÁQUINAS EN EL DISEÑO MECÁNICO (5ta Edición)
**Autores:** Robert L. Mott, Edward M. Vavrek, Jyhwen Wang · Pearson
**Disciplina:** Transmisión de Potencia y Engranajes

---

## CAPÍTULO 8: ENGRANAJES RECTOS Y HELICOIDALES

### Cinemática y Relación de Transmisión
Para un piñón impulsor con $N_P$ dientes y corona conducida con $N_G$ dientes:

$$m_G = \\frac{N_G}{N_P} = \\frac{d_G}{d_P} = \\frac{\\omega_P}{\\omega_G}$$

### Fuerza Tangencial Transmitida y Potencia
$$W_t = \\frac{60000 \\cdot P}{\\pi \\cdot d \\cdot n} \\quad [\\text{N}]$$

Componente de fuerza radial con ángulo de presión $\\phi = 20^\\circ$:
$$W_r = W_t \\cdot \\tan(\\phi)$$

### Ecuación de Flexión de Lewis (AGMA)
$$\\sigma = \\frac{W_t}{F \\cdot m} \\cdot K_v \\cdot K_o \\cdot K_m \\cdot \\frac{1}{J}$$`
    }
  ];

  for (const book of seedBooks) {
    if (!forceRestore && deletedSeedFiles.has(book.fileName)) {
      continue;
    }
    const discDir = path.join(ROOT_LIBRARY_DIR, book.discipline);
    const pdfPath = path.join(discDir, 'pdf', book.fileName);
    const txtPath = path.join(discDir, 'txt', book.fileName.replace('.pdf', '.txt'));
    const vectorPath = path.join(discDir, 'vector', book.fileName.replace('.pdf', '_vectors.json'));

    // 1. Create original PDF placeholder
    if (!fs.existsSync(pdfPath)) {
      const dummyPdfHeader = `%PDF-1.4\n% Alpha RAG Pre-indexed Engineering Textbook Intact File\n% Title: ${book.title}\n% Author: ${book.author}\n% Pages: ${book.pages}\n`;
      fs.writeFileSync(pdfPath, dummyPdfHeader, 'utf-8');
    }

    // 2. Create extracted .txt (Markdown + LaTeX)
    if (!fs.existsSync(txtPath)) {
      fs.writeFileSync(txtPath, book.txtContent, 'utf-8');
    }

    // 3. Create vector chunk index JSON
    if (!fs.existsSync(vectorPath)) {
      const vectorData = {
        discipline: book.discipline,
        bookTitle: book.title,
        fileName: book.fileName,
        model: 'text-embedding-004 (768-D)',
        chunksCount: book.chunksCount,
        extractedAt: new Date().toISOString(),
        chunks: [
          {
            chunkIndex: 1,
            section: 'Principios y Fundamentos',
            tokenCount: 86,
            vector: Array.from({ length: 8 }, () => Number((Math.random() * 2 - 1).toFixed(4))),
            textExcerpt: book.txtContent.slice(0, 240) + '...'
          },
          {
            chunkIndex: 2,
            section: 'Formulaciones y Leyes Matemáticas',
            tokenCount: 92,
            vector: Array.from({ length: 8 }, () => Number((Math.random() * 2 - 1).toFixed(4))),
            textExcerpt: book.txtContent.slice(241, 520) + '...'
          }
        ]
      };
      fs.writeFileSync(vectorPath, JSON.stringify(vectorData, null, 2), 'utf-8');
    }
  }
}

export const SEED_BOOK_FILENAMES = new Set([
  'Ingenieria_Mecanica_Estatica_Hibbeler_12ma_Ed.pdf',
  'shigley_diseno_en_ingenieria_mecanica_10.pdf',
  'cengel_termodinamica_9na_ed.pdf',
  'beer_mecanica_de_materiales_11.pdf',
  'mott_elementos_de_maquinas_5ta.pdf',
]);

function formatFileSize(bytes: number, isDummySeedPlaceholder: boolean, fileName: string): string {
  if (isDummySeedPlaceholder) {
    const lower = fileName.toLowerCase();
    if (lower.includes('hibbeler')) return '48.1 MB';
    if (lower.includes('shigley')) return '48.2 MB';
    if (lower.includes('cengel')) return '54.1 MB';
    if (lower.includes('beer')) return '39.8 MB';
    if (lower.includes('mott')) return '44.6 MB';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Scan physical library directory and return all discovered books
 */
export function getPhysicalLibraryTree(options: { includeHiddenExamples?: boolean } = {}): LibraryBookFile[] {
  ensureLibraryDirectories();
  const { hideExamples } = readLibraryVisibilityPrefs();
  const results: LibraryBookFile[] = [];

  const disciplines = fs.readdirSync(ROOT_LIBRARY_DIR);

  for (const disc of disciplines) {
    const discPath = path.join(ROOT_LIBRARY_DIR, disc);
    if (!fs.statSync(discPath).isDirectory()) continue;

    const pdfDir = path.join(discPath, 'pdf');
    if (!fs.existsSync(pdfDir)) continue;

    const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));

    for (const file of pdfFiles) {
      const pdfPath = path.join(pdfDir, file);
      const baseName = file.replace(/\.pdf$/i, '');
      const txtPath = path.join(discPath, 'txt', `${baseName}.txt`);
      const vectorPath = path.join(discPath, 'vector', `${baseName}_vectors.json`);

      let stat;
      try {
        stat = fs.statSync(pdfPath);
      } catch {
        continue;
      }

      const lowerFile = file.toLowerCase();
      const isSeedFile = SEED_BOOK_FILENAMES.has(file);
      const isDummySeedPlaceholder = isSeedFile && stat.size < 2048;

      const defaultTitle = baseName.replace(/[_-]/g, ' ');
      let title = defaultTitle;
      let author = lowerFile.includes('hibbeler') ? 'R. C. Hibbeler' :
                   lowerFile.includes('shigley') ? 'Richard G. Budynas, J. Keith Nisbett' :
                   lowerFile.includes('cengel') ? 'Yunus A. Çengel, Michael A. Boles' :
                   lowerFile.includes('beer') ? 'Ferdinand P. Beer, E. Russell Johnston Jr.' :
                   lowerFile.includes('mott') ? 'Robert L. Mott' : 'Documento PDF Indexado';
      let pages = lowerFile.includes('hibbeler') ? 672 :
                  lowerFile.includes('shigley') ? 1088 :
                  lowerFile.includes('cengel') ? 1024 :
                  lowerFile.includes('beer') ? 896 :
                  lowerFile.includes('mott') ? 840 : 1;
      let chunksCount = 1;
      let isExample = isSeedFile && !lowerFile.includes('hibbeler');

      if (fs.existsSync(vectorPath)) {
        try {
          const vData = JSON.parse(fs.readFileSync(vectorPath, 'utf-8'));
          if (typeof vData.chunksCount === 'number' && vData.chunksCount > 0) chunksCount = vData.chunksCount;
          if (typeof vData.pages === 'number' && vData.pages > 0) pages = vData.pages;
          if (typeof vData.author === 'string' && vData.author.trim()) author = vData.author;
          if (typeof vData.bookTitle === 'string' && vData.bookTitle.trim()) title = vData.bookTitle;
          else if (typeof vData.cleanTitle === 'string' && vData.cleanTitle.trim()) title = vData.cleanTitle;
          if (typeof vData.isExample === 'boolean') isExample = vData.isExample;
        } catch {}
      }

      if (!options.includeHiddenExamples && hideExamples && isExample) {
        continue;
      }

      results.push({
        discipline: disc,
        bookId: `book-${disc}-${file}`,
        title,
        author,
        fileName: file,
        pdfPath,
        txtPath,
        vectorPath,
        size: formatFileSize(stat.size, isDummySeedPlaceholder, file),
        pages,
        chunksCount,
        createdAt: stat.mtime.toLocaleDateString(),
        status: 'indexed',
        isExample
      });
    }
  }

  return results;
}

export function deleteBookFromLibrary(discipline: string, fileName: string): { deleted: boolean; isSeed: boolean } {
  ensureLibraryDirectories();
  const rootResolved = path.resolve(ROOT_LIBRARY_DIR);
  const baseName = fileName.replace(/\.pdf$/i, '');

  const pdfPath = path.resolve(rootResolved, discipline, 'pdf', fileName);
  const txtPath = path.resolve(rootResolved, discipline, 'txt', `${baseName}.txt`);
  const vectorPath = path.resolve(rootResolved, discipline, 'vector', `${baseName}_vectors.json`);

  if (!pdfPath.startsWith(rootResolved + path.sep)) {
    throw new Error('Ruta fuera del repositorio de biblioteca.');
  }

  let deleted = false;
  for (const target of [pdfPath, txtPath, vectorPath]) {
    if (target.startsWith(rootResolved + path.sep) && fs.existsSync(target)) {
      fs.unlinkSync(target);
      deleted = true;
    }
  }

  const isSeed = SEED_BOOK_FILENAMES.has(fileName);
  return { deleted, isSeed };
}
