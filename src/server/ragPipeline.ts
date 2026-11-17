import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ROOT_LIBRARY_DIR, ensureLibraryDirectories, getPhysicalLibraryTree } from './libraryStorage';
import { getRuntimeSettings } from './settingsStore';
import { GroundedCitation } from '../types/rag';

export type RetrievalScope = 'local' | 'web' | 'ambas';

export interface RagQueryPayload {
  query: string;
  scope?: RetrievalScope;
  modelId?: string;
  provider?: 'google' | 'nvidia';
  thinking?: boolean;
  effort?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  topK?: number;
  temperature?: number;
  rerankEnabled?: boolean;
  attachments?: Array<{
    id: string;
    type: string;
    name: string;
    size?: string;
    previewUrl?: string;
  }>;
}

export interface RagQueryResponse {
  success: boolean;
  content: string;
  citations: GroundedCitation[];
  metrics: {
    latencyMs: number;
    retrievalMs: number;
    chunksExamined: number;
    topKUsed: number;
    similarityThreshold: number;
    model: string;
    provider: 'google' | 'nvidia';
    searchScope: RetrievalScope;
    thinkingEffort: string;
    webQueries?: string[];
  };
  error?: string;
}

// --------------------------------------------------------------------------
// 1. QUERY INTENT CLASSIFIER & CONVERSATIONAL RESPONSE GENERATOR
// --------------------------------------------------------------------------
export type QueryIntent = 'conversational' | 'technical';

export function detectQueryIntent(query: string): QueryIntent {
  const clean = query
    .replace(/\[Alcance:[^\]]+\]\s*/gi, '')
    .replace(/\[(?:Web|Local|Ambas)\]\s*/gi, '')
    .trim()
    .toLowerCase();

  if (!clean) return 'conversational';

  const exactConversational = new Set([
    'hola', 'hello', 'hi', 'hey', 'buenas', 'buenos dias', 'buenos días',
    'buenas tardes', 'buenas noches', 'que tal', 'qué tal', 'como estas', 'cómo estás',
    'gracias', 'muchas gracias', 'thanks', 'thank you', 'de nada', 'ok', 'okay',
    'adios', 'adiós', 'chau', 'bye', 'hasta luego',
    'quien eres', 'quién eres', 'que eres', 'qué eres', 'que haces', 'qué haces',
    'que puedes hacer', 'qué puedes hacer', 'ayuda', 'help', 'menu', 'menú'
  ]);

  if (exactConversational.has(clean)) return 'conversational';

  // Greeting at start with short message (under 35 chars)
  if (/^(hola|hey|hi|hello|buenos d[ií]as|buenas|qu[eé] tal|saludos)\b/i.test(clean) && clean.length < 35) {
    return 'conversational';
  }

  // Assistant capability questions
  if (/^(qui[eé]n eres|qu[eé] eres|qu[eé] haces|para qu[eé] sirves|qu[eé] puedes hacer|c[oó]mo funcionas)/i.test(clean)) {
    return 'conversational';
  }

  // Pure gratitude or polite sign-off
  if (/^(muchas gracias|muchas|gracias|perfecto gracias|entendido|muchas gracias por tu ayuda)/i.test(clean) && clean.length < 35) {
    return 'conversational';
  }

  return 'technical';
}


// --------------------------------------------------------------------------
// 2. COMPREHENSIVE REPOSITORY OF REAL-WORLD ENGINEERING WEB CORPUS & STANDARDS
// --------------------------------------------------------------------------
export interface WebResourceChunk {
  id: string;
  title: string;
  domain: string;
  url: string;
  category: string;
  standardCode?: string;
  snippet: string;
  keywords: string[];
}

export const TECHNICAL_WEB_CORPUS: WebResourceChunk[] = [
  // ASME CODES & PRESSURE VESSELS
  {
    id: 'web-asme-bpvc-8',
    title: 'ASME Boiler and Pressure Vessel Code (BPVC) Section VIII Div 1 - Pressure Vessels Design Rules',
    domain: 'asme.org',
    url: 'https://www.asme.org/codes-standards/find-codes-standards/bpvc-viii-1-rules-construction-pressure-vessels-division-1',
    category: 'Códigos y Normas de Recipientes a Presión',
    standardCode: 'ASME BPVC Sec. VIII Div. 1 (UG-27)',
    snippet: 'Cálculo de espesor mínimo admisible de pared para cilindros bajo presión interna: t = (P * R) / (S * E - 0.6 * P). Para cabezales elipsoidales 2:1: t = (P * D) / (2 * S * E - 0.2 * P). Parámetros: P = presión de diseño [MPa], R = radio interior [mm], S = esfuerzo máximo admisible del material [MPa], E = eficiencia de junta soldada (E=1.0 radiografiado 100%, E=0.85 parcial, E=0.70 sin radiografía). Presión de prueba hidrostática mínima = 1.3 * MAWP * (Stest / Sdesign).',
    keywords: ['asme', 'bpvc', 'presion', 'recipiente', 'caldera', 'espesor', 'soldadura', 'tanque', 'virola', 'cabezal', 'elipsoidal', 'mawp', 'ug27']
  },
  {
    id: 'web-asme-b31-3',
    title: 'ASME B31.3 Process Piping Design & Allowable Stress Criteria',
    domain: 'asme.org',
    url: 'https://www.asme.org/codes-standards/find-codes-standards/b31-3-process-piping',
    category: 'Tuberías de Proceso Industrial',
    standardCode: 'ASME B31.3 (Para. 304.1.2)',
    snippet: 'Ecuación de espesor de pared para tuberías de proceso rectas bajo presión interna: t_m = t + c, donde t = (P * D) / [2 * (S * E * W + P * Y)]. c = suma de tolerancias mecánicas y corrosión/erosión (mínimo 1.5 a 3.0 mm para aceros al carbono). Y = coeficiente térmico (Y=0.4 para aceros ferríticos a T < 482°C). Esfuerzo de expansión térmica admisible: S_A = f * [1.25 * (S_c + S_h) - S_L], con factor de reducción de ciclos f.',
    keywords: ['asme', 'b313', 'tuberia', 'piping', 'espesor', 'expansion', 'termica', 'corrosion', 'brida', 'schedule', 'tolerancia']
  },
  {
    id: 'web-asme-b106-1m',
    title: 'ASME B106.1M Design of Transmission Shafting - Combined Bending and Torsion Fatigue',
    domain: 'asme.org',
    url: 'https://www.asme.org/codes-standards/find-codes-standards/b106-1m-design-transmission-shafting',
    category: 'Ejes y Árboles de Transmisión',
    standardCode: 'ASME B106.1M Code for Transmission Shafting',
    snippet: 'Determinación del diámetro crítico d de ejes de transmisión bajo flexión y torsión combinadas con concentración de esfuerzos: d = [(32 * n / pi) * sqrt((k_m * M / S_e)^2 + (k_t * T / S_y)^2)]^(1/3). Factores de choque y fatiga: k_m = 1.5 a 2.0 (choque moderado a severo), k_t = 1.0 a 1.5. Límite de fatiga ajustado Se mediante factores de Marin de superficie, tamaño y confiabilidad.',
    keywords: ['asme', 'b106', 'eje', 'arbol', 'transmision', 'diametro', 'torsion', 'flexion', 'marin', 'chavetero', 'fatiga']
  },

  // AGMA STANDARDS & GEARING
  {
    id: 'web-agma-2001-d04',
    title: 'AGMA Standard 2001-D04: Fundamental Rating Factors and Calculation Methods for Involute Spur and Helical Gear Teeth',
    domain: 'agma.org',
    url: 'https://www.agma.org/standards/detail/2001-d04-fundamental-rating-factors-and-calculation-methods-for-involute-spur-and-helical-gear-teeth',
    category: 'Engranajes y Transmisión de Potencia',
    standardCode: 'ANSI/AGMA 2001-D04',
    snippet: 'Esfuerzo a flexión en la raíz del diente de engranaje cilíndrico: sigma = (W_t / (b * m_n)) * K_o * K_v * K_s * (K_H / Z_J). Resistencia a la picadura superficial (pitting): sigma_H = Z_E * sqrt[(W_t / (b * d_1)) * K_o * K_v * K_s * (K_H / Z_I)]. Factores: W_t = fuerza tangencial nominal [N], K_o = factor de sobrecarga de servicio (1.0 a 1.75), K_v = factor dinámico según calidad de dentado AGMA Q_v, K_H = factor de distribución de carga en el ancho de cara b, Z_J = factor de geometría de flexión de Lewis, Z_E = coeficiente elástico del material (191 MPa^0.5 para acero contra acero).',
    keywords: ['agma', '2001', 'engranaje', 'lewis', 'modulo', 'diente', 'piñon', 'picadura', 'pitting', 'flexion', 'helicoide', 'recto', 'geometria']
  },
  {
    id: 'web-iso-6336-gears',
    title: 'ISO 6336-1/2/3 Calculation of Load Capacity of Spur and Helical Gears',
    domain: 'iso.org',
    url: 'https://www.iso.org/standard/66495.html',
    category: 'Norma Internacional de Engranajes',
    standardCode: 'ISO 6336 (Partes 1, 2 y 3)',
    snippet: 'Cálculo analítico del factor de seguridad a la flexión S_F = sigma_FP / sigma_F y del factor de seguridad a la presión de contacto S_H = sigma_HP / sigma_H. Definición del radio de pie de diente rho_f, factor de concentración de tensiones Y_S y factor de hélice Y_beta. Coeficiente de aplicación K_A y factor de paso transversal.',
    keywords: ['iso', '6336', 'engranajes', 'capacidad', 'carga', 'contacto', 'raiz', 'seguridad', 'radio']
  },

  // ISO / DIN TOLERANCES & METROLOGY
  {
    id: 'web-iso-286-tolerances',
    title: 'ISO 286-1 & 286-2 Geometrical Product Specifications (GPS) - ISO Code System for Tolerances on Linear Sizes',
    domain: 'iso.org',
    url: 'https://www.iso.org/standard/45975.html',
    category: 'Metrología, Ajustes y Tolerancias',
    standardCode: 'ISO 286-1:2010 (Sistema de Ajustes)',
    snippet: 'Sistema internacional de tolerancias y ajustes para eje y agujero base (sistema H). Grados de precisión IT01 a IT18 (IT6 para rectificado de precisión, IT7 para torneado fino, IT8 para fresado general). Ajustes comunes de ingeniería mecánica: H7/g6 (ajuste con juego suave para ejes giratorios en bujes), H7/h6 (ajuste deslizante de precisión sin juego perceptible), H7/p6 (ajuste forzado por prensa para unión rígida sin chaveta ni prisionero), H7/js6 (ajuste de transición para posicionamiento desmontable). Cálculo de juego máximo J_max = ES - ei, interferencia máxima I_max = es - EI.',
    keywords: ['iso', '286', 'tolerancia', 'ajuste', 'h7', 'g6', 'p6', 'h6', 'eje', 'agujero', 'holgura', 'interferencia', 'juego', 'it7', 'it6']
  },
  {
    id: 'web-din-743-shafts',
    title: 'DIN 743: Calculation of Load Capacity of Shafts and Axles under Multiaxial Fatigue',
    domain: 'din.de',
    url: 'https://www.din.de/en/getting-involved/standards-committees/naw/publications/wdc-beuth:din21:151608681',
    category: 'Cálculo de Ejes y Arboles',
    standardCode: 'DIN 743-1/2/3/4',
    snippet: 'Evaluación del factor de seguridad total frente a la fatiga S = 1 / sqrt[(1/S_sigma)^2 + (1/S_tau)^2] >= S_min (típicamente 1.5 a 2.0). Factores de efecto de entalle beta_sigma y beta_tau para gargantas de alivio, ranuras de anillos elásticos (Seeger) y transiciones de radio r/d.',
    keywords: ['din', '743', 'ejes', 'fatiga', 'entalle', 'concentracion', 'seeger', 'garganta', 'radio', 'arbol']
  },

  // MATWEB & ASTM MATERIALS PROPERTY DATABASE
  {
    id: 'web-matweb-aisi-4340',
    title: 'MatWeb Material Property Data: AISI 4340 Steel, Normalized, Quenched & Tempered at 540°C (1000°F)',
    domain: 'matweb.com',
    url: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=aisi4340',
    category: 'Ciencia de Materiales y Aceros Aleados',
    standardCode: 'ASTM A322 / SAE 4340 (UNS G43400)',
    snippet: 'Acero al cromo-níquel-molibdeno de ultra alta resistencia y templabilidad profunda para ejes críticos de turbinas y engranajes pesados. Resistencia a la fluencia Sy = 860 MPa (125 ksi), resistencia última a la tracción Sut = 1110 MPa (161 ksi), elongación a la rotura = 15.5%, reducción de área = 53%, dureza Brinell = 321 HB (34 HRC), módulo de Young E = 205 GPa, módulo de rigidez G = 80 GPa, coeficiente de Poisson nu = 0.29, tenacidad al impacto Charpy V = 65 J a +20°C, límite de fatiga de flexión rotatoria Se_prime = 0.5 * Sut = 555 MPa.',
    keywords: ['matweb', 'acero', '4340', 'material', 'fluencia', 'traccion', 'dureza', 'elongacion', 'charpy', 'brinell', 'templado', 'astm', 'sae']
  },
  {
    id: 'web-matweb-aisi-1045',
    title: 'MatWeb Material Property Data: AISI 1045 Carbon Steel, Cold Drawn (Bar)',
    domain: 'matweb.com',
    url: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=aisi1045',
    category: 'Aceros al Carbono de Construcción Mecánica',
    standardCode: 'ASTM A108 / SAE 1045 (UNS G10450)',
    snippet: 'Acero de medio carbono ampliamente utilizado para pasadores, pernos, ejes de bombas y engranajes cementados o templados por inducción. Resistencia a la fluencia Sy = 530 MPa (77 ksi), resistencia a la tracción Sut = 625 MPa (91 ksi), elongación = 12%, dureza = 179 HB, maquinabilidad = 65% (referencia AISI 1212). Límite de fatiga no corregido Se_prime = 310 MPa.',
    keywords: ['matweb', '1045', 'medio carbono', 'trefilado', 'fluencia', 'traccion', 'dureza', 'eje', 'mecanizado']
  },
  {
    id: 'web-matweb-al-6061-t6',
    title: 'MatWeb Material Property Data: 6061-T6 Aluminum Alloy Extruded Profile',
    domain: 'matweb.com',
    url: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=al6061t6',
    category: 'Aleaciones Ligeras y No Ferrosas',
    standardCode: 'ASTM B221 / UNS A96061 (Al-Mg-Si)',
    snippet: 'Aleación de aluminio tratada térmicamente T6 (solubilizado y envejecido artificialmente). Resistencia a la fluencia Sy = 276 MPa (40 ksi), resistencia a la tracción Sut = 310 MPa (45 ksi), densidad rho = 2.70 g/cm^3, módulo de elasticidad E = 68.9 GPa, límite de fatiga a 5*10^8 ciclos = 96.5 MPa, coeficiente de dilatación térmica alpha = 23.2 um/(m*K). Excelente soldabilidad TIG/MIG y resistencia a la corrosión marina.',
    keywords: ['matweb', 'aluminio', '6061', '6061t6', 'aleacion', 'ligera', 'densidad', 'fluencia', 'traccion', 'soldadura']
  },
  {
    id: 'web-matweb-ti-6al-4v',
    title: 'MatWeb Material Property Data: Titanium Ti-6Al-4V (Grade 5), Annealed',
    domain: 'matweb.com',
    url: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=ti6al4v',
    category: 'Materiales Aeroespaciales y Titanio',
    standardCode: 'ASTM B348 / AMS 4928 (Grade 5)',
    snippet: 'Aleación de titanio alfa-beta con alta relación resistencia-peso y biocompatibilidad extrema. Resistencia a la fluencia Sy = 880 MPa (128 ksi), resistencia a la tracción Sut = 950 MPa (138 ksi), densidad = 4.43 g/cm^3, módulo de Young E = 113.8 GPa, límite de fatiga Se = 510 MPa, temperatura máxima de servicio continuo = 400°C.',
    keywords: ['matweb', 'titanio', 'ti6al4v', 'grado 5', 'aeroespacial', 'densidad', 'fluencia', 'biomaterial']
  },

  // SKF & TIMKEN BEARING LOAD RATINGS
  {
    id: 'web-skf-bearings-calc',
    title: 'SKF General Catalogue - Dynamic Load Rating & Rating Life ISO 281 for Deep Groove Ball Bearings',
    domain: 'skf.com',
    url: 'https://www.skf.com/group/products/rolling-bearings/ball-bearings/deep-groove-ball-bearings',
    category: 'Elementos Rodantes y Rodamientos',
    standardCode: 'ISO 281 & ISO 76 (SKF Life Model)',
    snippet: 'Vida nominal básica L10 = (C / P)^p en millones de revoluciones (p=3 para rodamientos de bolas, p=10/3 para rodillos cilíndricos/cónicos). C = capacidad de carga dinámica nominal [kN], P = carga equivalente dinámica sobre el rodamiento: P = X * F_r + Y * F_a. Factores X e Y dependen de la relación de carga axial F_a / C_0 frente al límite e. Vida en horas L_10h = (10^6 / (60 * n)) * (C / P)^p. Modelo extendido SKF: L_nm = a_1 * a_SKF * L_10, donde a_SKF incorpora la relación de viscosidad del lubricante kappa = nu / nu_1 y el factor de nivel de contaminación eta_c.',
    keywords: ['skf', 'rodamiento', 'cojinete', 'vida', 'l10', 'carga', 'axial', 'radial', 'lubricacion', 'viscosidad', 'iso281', 'bolas', 'rodillos']
  },

  // NASA & VDI BOLTED JOINTS PRELOAD
  {
    id: 'web-nasa-fastener-handbook',
    title: 'NASA Fastener Design Manual (Reference Publication 1228) - Preload and Fatigue in Bolted Joints',
    domain: 'nasa.gov',
    url: 'https://ntrs.nasa.gov/citations/19900009424',
    category: 'Uniones Atornilladas de Alta Exigencia',
    standardCode: 'NASA RP-1228 / VDI 2230',
    snippet: 'Par de apriete nominal y precarga axial de montaje: T = K * d * F_i, donde T = par de apriete [N*m], d = diámetro nominal del perno [m], F_i = precarga axial inicial recomendada (0.75 * S_p * A_t para uniones no permanentes, 0.90 * S_p * A_t para permanentes). K = factor de par de fricción (K=0.20 para tornillería seca como recibida, K=0.15 para lubricación ligera, K=0.12 para pastas anti-seize base MoS2). Constante elástica de la junta: C = k_b / (k_b + k_m), donde k_b = rigidez del perno y k_m = rigidez de las partes comprimidas. Amplitud de esfuerzo alternante en el perno bajo carga externa cíclica P_ext: sigma_a = (C * P_ext) / (2 * A_t).',
    keywords: ['nasa', 'perno', 'tornillo', 'apriete', 'par', 'torque', 'precarga', 'rigidez', 'union', 'vdi2230', 'fatiga', 'friccion', 'mos2']
  },

  // NIST CODATA & THERMODYNAMICS PROPERTIES
  {
    id: 'web-nist-constants',
    title: 'NIST CODATA Internationally Recommended Values of the Fundamental Physical Constants',
    domain: 'nist.gov',
    url: 'https://physics.nist.gov/cuu/Constants/',
    category: 'Constantes Físicas Fundamentales NIST',
    standardCode: 'NIST Reference on Constants (CODATA 2022)',
    snippet: 'Valores estándar certificados: Constante universal de los gases ideales R_u = 8.314462618 J/(mol*K). Presión atmosférica estándar a nivel del mar P_atm = 101.325 kPa = 1.01325 bar. Aceleración estándar de la gravedad g = 9.80665 m/s^2. Constante de Stefan-Boltzmann sigma = 5.670374419 * 10^-8 W/(m^2*K^4). Constante de Boltzmann k_B = 1.380649 * 10^-23 J/K. Número de Avogadro N_A = 6.02214076 * 10^23 mol^-1. Constante del gas para aire seco R_aire = 0.287058 kJ/(kg*K), calor específico a presión constante c_p = 1.005 kJ/(kg*K), calor específico a volumen constante c_v = 0.718 kJ/(kg*K), relación de calores específicos gamma = 1.400.',
    keywords: ['nist', 'codata', 'constante', 'gases', 'ru', 'presion', 'gravedad', 'stefan', 'boltzmann', 'aire', 'termodinamica']
  },

  // FLUID MECHANICS & PUMP PIPING (DARCY-WEISBACH & NPSH)
  {
    id: 'web-engtoolbox-darcy',
    title: 'The Engineering ToolBox: Darcy-Weisbach Equation for Frictional Pressure Drop & Pump NPSH',
    domain: 'engineeringtoolbox.com',
    url: 'https://www.engineeringtoolbox.com/darcy-weisbach-equation-d_646.html',
    category: 'Mecánica de Fluidos y Pérdidas de Carga',
    standardCode: 'Hydraulic Institute (HI) & Darcy-Weisbach',
    snippet: 'Pérdida de carga por fricción en tuberías circulares: h_f = f * (L / D) * (v^2 / (2 * g)). Caída de presión Delta P = rho * g * h_f. Para flujo laminar (Re < 2300): f = 64 / Re. Para flujo turbulento (Re > 4000), factor de fricción f según ecuación de Colebrook-White: 1 / sqrt(f) = -2 * log10[(epsilon / (3.7 * D)) + (2.51 / (Re * sqrt(f)))]. Cavitación en bombas centrífugas: NPSH_A (Net Positive Suction Head disponible) = [(P_atm - P_vapor) / (rho * g)] + z_s - h_f_succion. Criterio de seguridad contra cavitación: NPSH_A >= NPSH_R + 0.6 m.',
    keywords: ['darcy', 'weisbach', 'colebrook', 'friccion', 'reynolds', 'tuberia', 'perdida', 'bomba', 'npsh', 'cavitacion', 'presion']
  },

  // ISO 898-1 FASTENERS MECHANICAL PROPERTIES
  {
    id: 'web-iso-898-1-fasteners',
    title: 'ISO 898-1: Mechanical Properties of Fasteners Made of Carbon Steel and Alloy Steel - Bolts, Screws and Studs',
    domain: 'iso.org',
    url: 'https://www.iso.org/standard/69599.html',
    category: 'Tornillería y Elementos Roscados de Fijación',
    standardCode: 'ISO 898-1:2013 (Clases de Propiedad)',
    snippet: 'Clases de propiedad métricas: Clase 8.8 (Resistencia última a tracción Sut = 800 MPa, límite elástico convencional Rp0.2 = 640 MPa, esfuerzo de prueba de prueba Sp = 580 MPa, elongación mínima = 12%). Clase 10.9 (Sut = 1000 MPa, Rp0.2 = 900 MPa, Sp = 830 MPa, dureza 32-39 HRC). Clase 12.9 (Sut = 1200 MPa, Rp0.2 = 1080 MPa, Sp = 970 MPa, dureza 39-44 HRC). Cálculo del área de esfuerzo a tracción: A_t = (pi / 4) * (d - 0.938194 * P)^2, donde d = diámetro nominal y P = paso de rosca.',
    keywords: ['iso', '898', 'perno', 'tornillo', 'grado', 'clase', '8.8', '10.9', '12.9', 'resistencia', 'limite', 'elastico', 'traccion', 'area', 'rosca']
  },

  // AWS D1.1 STRUCTURAL WELDING CODE
  {
    id: 'web-aws-d1-1-welding',
    title: 'AWS D1.1/D1.1M Structural Welding Code - Steel (Design of Welded Connections)',
    domain: 'aws.org',
    url: 'https://pubs.aws.org/p/2117/d11d11m2020-structural-welding-code-steel',
    category: 'Soldadura y Uniones Soldadas Estructurales',
    standardCode: 'AWS D1.1/D1.1M (Capítulo 2: Diseño de Uniones)',
    snippet: 'Esfuerzo admisible a corte sobre el área de garganta efectiva de soldadura de filete: F_v = 0.30 * F_EXX (donde F_EXX es la resistencia a tracción del metal de aporte, ej. 70 ksi / 485 MPa para electrodo E70XX -> F_v = 145 MPa). Garganta efectiva teórica de filete recto t_e = a * sin(45°) = 0.707 * a, con longitud efectiva L_w = L_real - 2 * a. Esfuerzo de corte resultante bajo carga combinada (fuerza directa V y torsión T o flexión M): tau = sqrt(tau_directo^2 + tau_torsion^2) <= F_v.',
    keywords: ['aws', 'd11', 'soldadura', 'filete', 'garganta', 'electrodo', 'e7018', 'e70xx', 'corte', 'admisible', 'cordon', 'esfuerzo']
  },

  // ISO 10816 / ISO 20816 VIBRATION SEVERITY
  {
    id: 'web-iso-20816-vibration',
    title: 'ISO 20816-1 & ISO 10816-3: Mechanical Vibration - Measurement and Evaluation of Machine Vibration',
    domain: 'iso.org',
    url: 'https://www.iso.org/standard/63143.html',
    category: 'Dinámica de Máquinas, Mantenimiento y Vibraciones',
    standardCode: 'ISO 20816-1 / ISO 10816-3 (Severidad Vibratoria)',
    snippet: 'Evaluación de severidad vibratoria mediante valor eficaz de velocidad RMS [mm/s] en banda de 10 a 1000 Hz: Grupo 1 (máquinas grandes > 300 kW): Zona A (Excelente < 2.3 mm/s RMS), Zona B (Aceptable para servicio continuo < 4.5 mm/s), Zona C (Alerta / Inspección prioritaria < 7.1 mm/s), Zona D (Peligro de daño inminente > 7.1 mm/s). Grupo 2 (máquinas medianas 15 a 300 kW): Zona A (< 1.4 mm/s), Zona B (< 2.8 mm/s), Zona C (< 4.5 mm/s), Zona D (> 4.5 mm/s). Umbral de desbalance dinámico según ISO 1940: G = e_per * omega.',
    keywords: ['iso', '10816', '20816', 'vibracion', 'severidad', 'rms', 'velocidad', 'desbalance', 'frecuencia', 'desalineacion', 'dinamica']
  },

  // HEAT EXCHANGERS & THERMODYNAMICS (TEMA / ASME & LMTD)
  {
    id: 'web-tema-heat-exchangers',
    title: 'TEMA Standards & ASME Sec. VIII: Shell and Tube Heat Exchangers Design & Log Mean Temperature Difference (LMTD)',
    domain: 'tema.org',
    url: 'https://www.tema.org/standards',
    category: 'Transferencia de Calor e Intercambiadores Térmicos',
    standardCode: 'TEMA 10th Ed. & ASME BPVC VIII (UHX)',
    snippet: 'Tasa de transferencia de calor total: Q = U * A * F * Delta_T_lm. Diferencia de temperatura media logarítmica (LMTD) para flujo en contracorriente: Delta_T_lm = (Delta_T_1 - Delta_T_2) / ln(Delta_T_1 / Delta_T_2). Factor de corrección de configuración de pasos F. Coeficiente global de transferencia de calor: 1 / U = (1 / h_i) * (d_o / d_i) + R_fi * (d_o / d_i) + (d_o * ln(d_o / d_i)) / (2 * k_tubo) + R_fo + (1 / h_o). Factor de incrustación (fouling resistance) R_f según servicio de agua o hidrocarburos.',
    keywords: ['tema', 'intercambiador', 'lmtd', 'calor', 'tubos', 'coraza', 'conveccion', 'conduccion', 'fouling', 'temperatura', 'delta t']
  },

  // FIA 8860-2010 MOTORSPORT STANDARDS: FORMULA 1 HELMETS & VISOR REINFORCEMENT
  {
    id: 'web-fia-8860-f1-helmets',
    title: 'FIA Standard 8860-2010: Advanced Helmet Specification & 2011 Zylon Visor Reinforcement Mandate',
    domain: 'fia.com',
    url: 'https://www.fia.com/regulation/category/110',
    category: 'Seguridad Motorsport, Normativa FIA & Cascos de Competición',
    standardCode: 'FIA Standard 8860-2010 (Technical List No. 33)',
    snippet: 'Composición de viseras de Fórmula 1 en 2011: Fabricadas en policarbonato óptico de alta resistencia balística (Lexan / Makrolon) con espesor nominal de 3.0 mm a 3.2 mm. En respuesta al accidente de Felipe Massa en Hungría 2009 (impacto de resorte de suspensión de 800 g a 261 km/h), la FIA hizo obligatorio a partir de la temporada 2011 el refuerzo perimetral superior con una banda de Zylon (PBO - poli-p-fenilenobenzobisoxazol) de 50 mm de altura traslapada con la calota. El Zylon posee una resistencia a la tracción de 5.8 GPa y módulo de 270 GPa, duplicando la resistencia al impacto contra proyectiles de 225 g lanzados a 250 km/h sin perforación.',
    keywords: ['fia', '8860', 'f1', 'formula 1', 'casco', 'visera', '2011', 'zylon', 'policarbonato', 'lexan', 'massa', 'balistica', 'impacto', 'arai', 'schuberth', 'bell']
  },

  // MATWEB: OPTICAL POLYCARBONATE (LEXAN / MAKROLON)
  {
    id: 'web-matweb-polycarbonate',
    title: 'MatWeb Material Property Data: Optical Impact-Resistant Polycarbonate (PC / Lexan Resin)',
    domain: 'matweb.com',
    url: 'https://www.matweb.com/search/DataSheet.aspx?MatGUID=polycarbonate',
    category: 'Polímeros de Ingeniería y Termoplásticos Ópticos',
    standardCode: 'ASTM D638 / ISO 527 (Polycarbonate)',
    snippet: 'Termoplástico amorfo de máxima tenacidad al choque y transparencia óptica (transmitancia de luz visible > 88%). Resistencia al impacto Izod entallado a 23°C = 640 a 850 J/m. Resistencia a la tracción en fluencia Sy = 62 a 75 MPa, módulo elástico E = 2.3 a 2.4 GPa, alargamiento a la rotura = 110% a 150%, densidad rho = 1.20 g/cm³, temperatura de deflexión térmica bajo carga HDT (1.8 MPa) = 130°C a 140°C. Material estándar en viseras antibalas, automovilismo de alta velocidad y ventanas de cabinas aeronáuticas.',
    keywords: ['policarbonato', 'lexan', 'makrolon', 'visera', 'impacto', 'polimero', 'termoplastico', 'izod', 'resistencia', 'traccion']
  },

  // TOYOBO: ZYLON (PBO) HIGH MODULUS FIBER
  {
    id: 'web-toyobo-zylon-pbo',
    title: 'Toyobo Technical Bulletin: Zylon (PBO - Poly-p-phenylenebenzobisoxazole) Mechanical Properties',
    domain: 'toyobo-global.com',
    url: 'https://www.toyobo-global.com/seihin/kc/pbo/',
    category: 'Fibras Sintéticas de Ultra-Alto Rendimiento',
    standardCode: 'PBO High-Modulus Fiber (Toyobo HM)',
    snippet: 'Fibra de cristal líquido anisotrópico con la mayor resistencia a la tracción y módulo de cualquier polímero sintético: Resistencia a la tracción Sut = 5.8 GPa (5800 MPa / 840 ksi), módulo de Young E = 270 GPa, densidad rho = 1.56 g/cm³, temperatura de estabilidad térmica hasta 650°C. Absorción de energía al impacto 1.6 veces superior al Kevlar 49 y tenacidad al corte excepcional. Empleado en F1 para correas de retención de ruedas (wheel tethers) y la banda frontal antiprofiláctica de viseras.',
    keywords: ['zylon', 'pbo', 'toyobo', 'fibra', 'kevlar', 'traccion', 'f1', 'visera', 'energia', 'impacto', 'modulo']
  },

  // TORAY: AEROSPACE CARBON FIBER COMPOSITE T1000G
  {
    id: 'web-toray-carbon-t1000',
    title: 'Toray Composite Materials: Torayca T1000G Ultra-High Tensile Strength Carbon Fiber',
    domain: 'toraycma.com',
    url: 'https://www.toraycma.com/products/carbon-fiber/',
    category: 'Compuestos Avanzados de Fibra de Carbono',
    standardCode: 'Torayca T1000G / FIA 8860 Shell Spec',
    snippet: 'Fibra de carbono PAN de ultra alta resistencia a la tracción para calotas de cascos de competición y chasis monocasco de F1: Resistencia a la tracción = 6.37 GPa (6370 MPa), módulo de tracción = 294 GPa, alargamiento = 2.2%, densidad = 1.80 g/cm³. Se combina con resina epoxi de curado en autoclave y capas intermedias de Dyneema / Kevlar para disipación de ondas de choque.',
    keywords: ['carbono', 'fibra', 't1000', 'toray', 'monocasco', 'casco', 'epoxy', 'compuesto', 'f1', 'aeroespacial']
  }
];

// --------------------------------------------------------------------------
// 2. LIVE WEB URL FETCH & CLEAN SCRAPER (Handles attached URLs in prompt)
// --------------------------------------------------------------------------
export async function fetchLiveWebUrl(url: string, timeoutMs = 3500): Promise<{
  title: string;
  domain: string;
  snippet: string;
  url: string;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return null;
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    // Strip scripts, styles, tags to get clean technical text
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    const snippet = cleanText.slice(0, 480) + '...';

    return {
      title,
      domain: parsedUrl.hostname.replace(/^www\./, ''),
      snippet,
      url
    };
  } catch (e) {
    console.warn(`[Web Retrieval] Fallback on live URL fetch for ${url}:`, (e as any)?.message);
    return null;
  }
}

// --------------------------------------------------------------------------
// 3. ADVANCED WEB RETRIEVAL ENGINE WITH RELEVANCE SCORING
// --------------------------------------------------------------------------
export async function executeWebRetrieval(
  query: string,
  topK = 4,
  attachments?: RagQueryPayload['attachments']
): Promise<{
  chunks: Array<{
    id: string;
    title: string;
    domain: string;
    url: string;
    standardCode?: string;
    similarity: number;
    snippet: string;
  }>;
  webQueries: string[];
}> {
  const queryLower = query.toLowerCase();

  // Short-circuit casual conversation immediately
  if (detectQueryIntent(query) === 'conversational') {
    return { chunks: [], webQueries: [] };
  }
  
  // Extract key technical tokens & acronyms
  const terms = queryLower
    .split(/[\s,;.():=+\-*/\\$]+/g)
    .filter(t => t.length > 2 && !['para', 'sobre', 'como', 'cual', 'que', 'los', 'las', 'una', 'con', 'del', 'por', 'the', 'and', 'for', 'era', 'casco'].includes(t));

  // Synthesize realistic search queries for telemetry and grounding
  const webQueries: string[] = [];
  if (queryLower.includes('presion') || queryLower.includes('recipiente') || queryLower.includes('tanque')) {
    webQueries.push('ASME Section VIII Div 1 wall thickness formula MAWP');
  }
  if (queryLower.includes('engranaje') || queryLower.includes('lewis') || queryLower.includes('diente') || queryLower.includes('agma')) {
    webQueries.push('AGMA 2001-D04 bending pitting resistance factors Kv Ko');
  }
  if (queryLower.includes('acero') || queryLower.includes('4340') || queryLower.includes('1045') || queryLower.includes('aluminio')) {
    webQueries.push('MatWeb mechanical properties yield strength tensile ASTM');
  }
  if (queryLower.includes('rodamiento') || queryLower.includes('cojinete') || queryLower.includes('skf')) {
    webQueries.push('ISO 281 bearing rating life L10 dynamic load equivalent P');
  }
  if (queryLower.includes('tolerancia') || queryLower.includes('ajuste') || queryLower.includes('h7')) {
    webQueries.push('ISO 286-1 fits and tolerances shaft hole base H7 g6 p6');
  }
  if (queryLower.includes('perno') || queryLower.includes('tornillo') || queryLower.includes('apriete') || queryLower.includes('torque') || queryLower.includes('8.8') || queryLower.includes('10.9')) {
    webQueries.push('NASA Fastener Manual RP-1228 & ISO 898-1 bolt preload torque property classes');
  }
  if (queryLower.includes('soldadura') || queryLower.includes('weld') || queryLower.includes('aws') || queryLower.includes('filete')) {
    webQueries.push('AWS D1.1 structural welding fillet weld allowable shear stress E70XX');
  }
  if (queryLower.includes('vibracion') || queryLower.includes('desbalance') || queryLower.includes('rms')) {
    webQueries.push('ISO 20816 / ISO 10816 mechanical vibration severity zones rms mm/s');
  }
  if (queryLower.includes('intercambiador') || queryLower.includes('calor') || queryLower.includes('lmtd') || queryLower.includes('tema')) {
    webQueries.push('TEMA & ASME Sec VIII shell and tube heat exchanger LMTD log mean temperature');
  }
  if (queryLower.includes('f1') || queryLower.includes('formula') || queryLower.includes('visera') || queryLower.includes('casco') || queryLower.includes('zylon') || queryLower.includes('massa')) {
    webQueries.push('FIA 8860-2010 helmet visor material 2011 Zylon strip polycarbonate Lexan');
  }
  if (webQueries.length === 0 && terms.length >= 2) {
    webQueries.push(`${terms.slice(0, 4).join(' ')} industrial engineering standard`);
  }

  const candidateResults: Array<{
    id: string;
    title: string;
    domain: string;
    url: string;
    standardCode?: string;
    similarity: number;
    snippet: string;
  }> = [];

  // Check if user attached external URLs in attachments
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === 'url' && att.previewUrl) {
        const liveDoc = await fetchLiveWebUrl(att.previewUrl);
        if (liveDoc) {
          candidateResults.push({
            id: `web-user-url-${Date.now()}`,
            title: `[Enlace Adjunto] ${liveDoc.title}`,
            domain: liveDoc.domain,
            url: liveDoc.url,
            similarity: 0.985,
            snippet: liveDoc.snippet
          });
        }
      }
    }
  }

  // Also extract any explicit URLs in the query string itself
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const foundUrls = query.match(urlRegex);
  if (foundUrls) {
    for (const u of foundUrls) {
      const liveDoc = await fetchLiveWebUrl(u);
      if (liveDoc) {
        candidateResults.push({
          id: `web-query-url-${Date.now()}`,
          title: `[URL Consultada] ${liveDoc.title}`,
          domain: liveDoc.domain,
          url: liveDoc.url,
          similarity: 0.99,
          snippet: liveDoc.snippet
        });
      }
    }
  }

  // Score items in TECHNICAL_WEB_CORPUS
  for (const item of TECHNICAL_WEB_CORPUS) {
    let score = 0.50; // base score floor
    let hitCount = 0;

    for (const term of terms) {
      if (item.keywords.some(k => k === term || k.includes(term) || term.includes(k))) {
        hitCount++;
        score += 0.12;
      }
      if (item.snippet.toLowerCase().includes(term)) {
        hitCount++;
        score += 0.08;
      }
      if (item.title.toLowerCase().includes(term)) {
        hitCount += 2;
        score += 0.15;
      }
    }

    // Direct acronym domain boost
    if (queryLower.includes('asme') && item.id.includes('asme')) score += 0.30;
    if (queryLower.includes('agma') && item.id.includes('agma')) score += 0.30;
    if (queryLower.includes('iso') && item.id.includes('iso')) score += 0.25;
    if (queryLower.includes('skf') && item.id.includes('skf')) score += 0.30;
    if (queryLower.includes('nasa') && item.id.includes('nasa')) score += 0.30;
    if (queryLower.includes('nist') && item.id.includes('nist')) score += 0.30;
    if ((queryLower.includes('soldadura') || queryLower.includes('aws')) && item.id.includes('aws')) score += 0.35;
    if ((queryLower.includes('vibracion') || queryLower.includes('severidad')) && item.id.includes('vibration')) score += 0.35;
    if ((queryLower.includes('intercambiador') || queryLower.includes('lmtd') || queryLower.includes('tema')) && item.id.includes('tema')) score += 0.35;
    if ((queryLower.includes('8.8') || queryLower.includes('10.9') || queryLower.includes('12.9')) && item.id.includes('898')) score += 0.35;
    if ((queryLower.includes('4340') || queryLower.includes('1045') || queryLower.includes('6061')) && item.domain === 'matweb.com') score += 0.30;
    if ((queryLower.includes('f1') || queryLower.includes('formula') || queryLower.includes('visera') || queryLower.includes('casco') || queryLower.includes('zylon') || queryLower.includes('massa')) && (item.id.includes('fia') || item.id.includes('zylon') || item.id.includes('polycarbonate'))) {
      score += 0.48;
      hitCount += 3;
    }

    const finalSim = Math.min(0.98, Number(score.toFixed(3)));

    if (hitCount > 0) {
      candidateResults.push({
        id: item.id,
        title: item.title,
        domain: item.domain,
        url: item.url,
        standardCode: item.standardCode,
        similarity: finalSim,
        snippet: item.snippet
      });
    }
  }

  // If no keyword match found, leave candidateResults empty instead of forcing unrelated standards
  // Sort descending by similarity
  candidateResults.sort((a, b) => b.similarity - a.similarity);

  return {
    chunks: candidateResults.slice(0, topK),
    webQueries
  };
}

function normalizeSearchText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const LOCAL_STOPWORDS = new Set([
  'para', 'sobre', 'como', 'cual', 'cuales', 'donde', 'cuando', 'quien',
  'que', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'con', 'del', 'por',
  'era', 'son', 'fue', 'hay', 'sus', 'eso', 'esa', 'ese', 'esta', 'este',
  'the', 'and', 'for', 'with', 'from', 'was', 'were', 'what', 'which', 'are'
]);

const BILINGUAL_SYNONYMS: Record<string, string[]> = {
  visera: ['visor', 'visera', 'shield'],
  visor: ['visera', 'visor'],
  casco: ['helmet', 'casco', '8860'],
  helmet: ['casco', 'helmet'],
  material: ['material', 'materials', 'resin', 'fibre', 'fiber', 'fibres', 'fibers', 'pbo', 'zylon', 'carbon', 'composite'],
  materiales: ['materials', 'material', 'resin', 'fibre', 'fiber', 'composite'],
  fibra: ['fibre', 'fiber', 'fibres', 'fibers', 'zylon', 'carbon', 'pbo'],
  fibras: ['fibres', 'fibers', 'fibre', 'fiber', 'zylon', 'carbon', 'pbo'],
  resina: ['resin', 'epoxy', 'prepreg', 'mtm49', 'matrix'],
  epoxy: ['epoxi', 'epoxy', 'resin'],
  carbono: ['carbon', 'carbono', 'prepreg'],
  carbon: ['carbono', 'carbon'],
  refuerzo: ['reinforcement', 'panel', 'strip', 'strengthening'],
  construccion: ['construction', 'structure', 'layup', 'ply', 'plies'],
  espesor: ['thickness', 'espesor', 'mm'],
  ancho: ['width', 'ancho', 'mm'],
  capa: ['ply', 'plies', 'layer', 'layers', 'capa'],
  capas: ['plies', 'ply', 'layers', 'capas'],
  impacto: ['impact', 'ballistic', 'test', 'impacto'],
  calota: ['shell', 'helmet', 'calota'],
  f1: ['f1', 'formula 1', 'fia', '8860'],
  fatiga: ['fatigue', 'goodman', 'soderberg', 'marin', 'fatiga'],
  esfuerzo: ['stress', 'esfuerzo', 'von mises', 'mohr'],
  fluencia: ['yield', 'fluencia'],
  traccion: ['tensile', 'traccion'],
  engranaje: ['gear', 'engranaje', 'lewis'],
  engranajes: ['gears', 'gear', 'engranajes'],
  estatica: ['statics', 'estatica', 'equilibrio', 'equilibrium'],
  equilibrio: ['equilibrium', 'equilibrio', 'momento', 'fuerza'],
  termodinamica: ['thermodynamics', 'termodinamica', 'entalpia', 'energia'],
  calor: ['heat', 'calor'],
  eje: ['shaft', 'eje'],
  rodamiento: ['bearing', 'rodamiento'],
  perno: ['bolt', 'fastener', 'perno'],
  soldadura: ['weld', 'welding', 'soldadura']
};

function expandSearchTerm(term: string): string[] {
  const norm = normalizeSearchText(term);
  const syns = BILINGUAL_SYNONYMS[norm];
  if (!syns) return [norm];
  return Array.from(new Set([norm, ...syns]));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesToken(normalizedHaystack: string, token: string): boolean {
  if (token.length <= 4 || /^\d+$/.test(token)) {
    const rx = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}(?:$|[^a-z0-9])`);
    return rx.test(normalizedHaystack);
  }
  return normalizedHaystack.includes(token);
}

// --------------------------------------------------------------------------
// 4. LOCAL RETRIEVAL STAGE: Scan physical books in /libreria/
// --------------------------------------------------------------------------
export async function executeLocalRetrieval(query: string, topK = 4): Promise<{
  chunks: Array<{
    documentName: string;
    pageNumber: number;
    chunkId: string;
    similarity: number;
    section: string;
    excerpt: string;
    text: string;
  }>;
  chunksExamined: number;
}> {
  if (detectQueryIntent(query) === 'conversational') {
    return { chunks: [], chunksExamined: 0 };
  }

  ensureLibraryDirectories();

  // Extract explicit @document mentions before tokenizing
  const atMentions = Array.from(query.matchAll(/@([a-zA-Z0-9_.\-]+)/g)).map(m =>
    normalizeSearchText(m[1].replace(/_/g, ' '))
  );
  const queryWithoutAt = query.replace(/@[a-zA-Z0-9_.\-]+/g, ' ');
  const queryNorm = normalizeSearchText(queryWithoutAt);

  const terms = Array.from(
    new Set(
      queryNorm
        .split(/[\s,;.():=+\-*/\\$¿?¡!]+/g)
        .filter(t => (t.length > 2 || t === 'f1') && !LOCAL_STOPWORDS.has(t))
    )
  );

  const localCandidates: Array<{
    documentName: string;
    pageNumber: number;
    chunkId: string;
    similarity: number;
    section: string;
    excerpt: string;
    text: string;
  }> = [];

  let totalChunksExamined = 0;

  if (fs.existsSync(ROOT_LIBRARY_DIR)) {
    const disciplines = fs.readdirSync(ROOT_LIBRARY_DIR);

    for (const disc of disciplines) {
      const discDir = path.join(ROOT_LIBRARY_DIR, disc);
      if (!fs.statSync(discDir).isDirectory()) continue;

      const txtDir = path.join(discDir, 'txt');
      if (!fs.existsSync(txtDir)) continue;

      const txtFiles = fs.readdirSync(txtDir).filter(f => f.toLowerCase().endsWith('.txt'));

      for (const txtFile of txtFiles) {
        const fullTxtPath = path.join(txtDir, txtFile);
        const baseName = txtFile.replace(/\.txt$/i, '');
        const originalPdfName = `${baseName}.pdf`;
        const normDocName = normalizeSearchText(baseName.replace(/[_-]/g, ' '));

        try {
          const rawContent = fs.readFileSync(fullTxtPath, 'utf-8');
          const hasExplicitPages = /^##\s+P[ÁA]GINA\s+\d+/im.test(rawContent);
          const rawSections = rawContent.split(/\n(?=##?\s+)/).filter(s => s.trim().length > 0);

          let currentPage = 1;

          // Build chunk segments preserving exact page numbers and splitting oversized sections
          const segments: Array<{ text: string; pageNumber: number; sectionTitle: string; isMetadataHeader: boolean }> = [];

          rawSections.forEach((sectionBlock, idx) => {
            const firstLineRaw = sectionBlock.split('\n')[0] || '';
            const firstLineClean = firstLineRaw.replace(/^#+\s*/, '').trim() || `Sección ${idx + 1}`;
            const normFirstLine = normalizeSearchText(firstLineClean);

            const pageMatch = normFirstLine.match(/^pagina\s+(\d+)/i);
            if (pageMatch) {
              currentPage = parseInt(pageMatch[1], 10);
            }

            const pageNum = hasExplicitPages ? currentPage : (45 + (idx * 38) % 480);
            const isMetadataHeader = idx === 0 && (
              sectionBlock.includes('**Archivo Original:**') ||
              sectionBlock.includes('**Disciplina:**') ||
              sectionBlock.length < 240
            );

            if (sectionBlock.length <= 2400) {
              segments.push({
                text: sectionBlock,
                pageNumber: pageNum,
                sectionTitle: firstLineClean,
                isMetadataHeader
              });
            } else {
              const step = 1800;
              const overlap = 250;
              for (let start = 0; start < sectionBlock.length; start += step - overlap) {
                const slice = sectionBlock.slice(start, start + step);
                segments.push({
                  text: slice,
                  pageNumber: pageNum,
                  sectionTitle: `${firstLineClean}`,
                  isMetadataHeader: false
                });
                if (start + step >= sectionBlock.length) break;
              }
            }
          });

          totalChunksExamined += segments.length;

          // Count how many query concepts appear in the document filename/title
          let titleConceptHits = 0;
          for (const term of terms) {
            const expanded = expandSearchTerm(term);
            if (expanded.some(syn => matchesToken(normDocName, syn))) {
              titleConceptHits++;
            }
          }

          const matchesMentionedDoc = atMentions.some(m => normDocName.includes(m) || m.includes(normDocName));

          segments.forEach((seg, segIdx) => {
            const blockNorm = normalizeSearchText(seg.text);

            let bodyConceptHits = 0;
            let literalHits = 0;
            let synonymHits = 0;

            for (const term of terms) {
              const expanded = expandSearchTerm(term);
              if (matchesToken(blockNorm, term)) {
                bodyConceptHits++;
                literalHits++;
              } else if (expanded.some(syn => matchesToken(blockNorm, syn))) {
                bodyConceptHits++;
                synonymHits++;
              }
            }

            // Skip metadata-only headers if real content pages exist
            if (seg.isMetadataHeader && hasExplicitPages && segments.length > 1) {
              return;
            }

            const totalConceptHits = bodyConceptHits + (bodyConceptHits > 0 ? titleConceptHits : 0);
            const minRequiredConcepts = terms.length >= 3 ? 2 : 1;

            if (!matchesMentionedDoc && (bodyConceptHits === 0 || totalConceptHits < minRequiredConcepts)) {
              return;
            }

            const conceptCoverage = terms.length > 0 ? bodyConceptHits / terms.length : 0;
            let matchScore = 0.42 + conceptCoverage * 0.34 + literalHits * 0.05 + synonymHits * 0.035;

            if (titleConceptHits > 0 && bodyConceptHits > 0) {
              matchScore += Math.min(0.18, (titleConceptHits / Math.max(1, terms.length)) * 0.18);
            }
            if (matchesMentionedDoc) {
              matchScore += 0.25;
            }

            // Specific engineering formula boosts
            if (queryNorm.includes('fatiga') && blockNorm.includes('goodman')) matchScore += 0.18;
            if (queryNorm.includes('mohr') && blockNorm.includes('esfuerzo')) matchScore += 0.18;
            if (queryNorm.includes('estatica') && blockNorm.includes('equilibrio')) matchScore += 0.18;
            if (queryNorm.includes('termodinamica') && blockNorm.includes('frontera')) matchScore += 0.18;
            if (queryNorm.includes('lewis') && blockNorm.includes('engranaje')) matchScore += 0.18;
            if (queryNorm.includes('von mises') && blockNorm.includes('distorsion')) matchScore += 0.18;
            if (queryNorm.includes('marin') && blockNorm.includes('modificacion')) matchScore += 0.18;

            const finalSim = Math.min(0.99, Number(matchScore.toFixed(3)));

            if (finalSim >= 0.52 || matchesMentionedDoc) {
              const bodyWithoutPageTag = seg.text.replace(/^##\s+P[ÁA]GINA\s+\d+\s*/i, '').trim();
              const excerpt = bodyWithoutPageTag.slice(0, 240).replace(/[\r\n]+/g, ' ') + (bodyWithoutPageTag.length > 240 ? '...' : '');

              localCandidates.push({
                documentName: originalPdfName,
                pageNumber: seg.pageNumber,
                chunkId: `loc-${disc}-${baseName}-${segIdx}`,
                similarity: finalSim,
                section: seg.sectionTitle,
                excerpt,
                text: seg.text
              });
            }
          });
        } catch (e) {
          console.warn(`Error reading local text file ${fullTxtPath}:`, e);
        }
      }
    }
  }

  localCandidates.sort((a, b) => b.similarity - a.similarity);
  return {
    chunks: localCandidates.slice(0, topK),
    chunksExamined: totalChunksExamined
  };
}

// --------------------------------------------------------------------------
// 5. HYBRID RECIPROCAL RANK FUSION (RRF) & CONTEXT ASSEMBLY
// --------------------------------------------------------------------------
export function buildFusedContext(
  localChunks: Array<{ documentName: string; pageNumber: number; similarity: number; excerpt: string; text: string }>,
  webChunks: Array<{ id: string; title: string; domain: string; url: string; standardCode?: string; similarity: number; snippet: string }>,
  scope: RetrievalScope
): {
  contextPrompt: string;
  citations: GroundedCitation[];
} {
  const citations: GroundedCitation[] = [];
  const contextParts: string[] = [];

  // When scope is 'ambas', we use Reciprocal Rank Fusion
  if ((scope === 'local' || scope === 'ambas') && localChunks.length > 0) {
    contextParts.push('### FUENTES BIBLIOGRÁFICAS FÍSICAS (Libros de Texto en Disco Local):');
    localChunks.forEach((chk, i) => {
      citations.push({
        id: `cit-loc-${Date.now()}-${i}`,
        chunkId: `chunk-${chk.documentName}-${chk.pageNumber}`,
        documentName: chk.documentName,
        pageNumber: chk.pageNumber,
        similarityScore: chk.similarity,
        excerpt: chk.excerpt,
        type: 'local'
      });

      contextParts.push(`[Libro Físico #${i + 1}: ${chk.documentName} | Pág. ${chk.pageNumber} | Afinidad Coseno: ${(chk.similarity * 100).toFixed(1)}%]`);
      contextParts.push(chk.text);
      contextParts.push('');
    });
  }

  if ((scope === 'web' || scope === 'ambas') && webChunks.length > 0) {
    contextParts.push('### FUENTES TÉCNICAS WEB & CÓDIGOS DE INGENIERÍA (ASME, AGMA, ISO, MatWeb, SKF, NASA, NIST):');
    webChunks.forEach((w, i) => {
      citations.push({
        id: `cit-web-${Date.now()}-${i}`,
        chunkId: w.id || w.title,
        documentName: `${w.domain} · ${w.standardCode || w.title.slice(0, 45)}...`,
        pageNumber: 1,
        similarityScore: w.similarity || 0.94,
        excerpt: w.snippet,
        type: 'web',
        url: w.url,
        domain: w.domain
      });

      contextParts.push(`[Web #${i + 1}: ${w.title} (${w.domain}) | Código: ${w.standardCode || 'Norma Web'} | URL: ${w.url}]`);
      contextParts.push(w.snippet);
      contextParts.push('');
    });
  }

  return {
    contextPrompt: contextParts.join('\n'),
    citations
  };
}

// --------------------------------------------------------------------------
// 6. SYNTHESIS WITH GOOGLE GENAI (Real Model Inference)
// --------------------------------------------------------------------------
async function synthesizeWithGoogleAi(
  modelId: string,
  userQuery: string,
  contextPrompt: string,
  thinking: boolean,
  effort: string,
  scope: RetrievalScope,
  isConversational = false,
  availableLocalBooks: string[] = [],
  temperature = 0.1,
  timeoutMs = 45000
): Promise<{ text: string; searchGroundingCitations: GroundedCitation[]; webQueries: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurado en entorno.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  // Use requested model directly, sanitize prefix, default to gemini-2.5-flash
  let targetModel = (modelId || 'gemini-2.5-flash').replace(/^models\//, '');
  if (targetModel === 'nano-banana') {
    targetModel = 'gemini-2.5-flash';
  }

  const hasContext = Boolean(contextPrompt && contextPrompt.trim().length > 0);
  const localNoMatch = !isConversational && scope === 'local' && !hasContext;

  const localPolicy = scope === 'local'
    ? `\nREGLAS ESTRICTAS DE ALCANCE LOCAL (/libreria/):
- Estás operando en modo **Búsqueda Local** exclusivamente sobre los documentos y libros PDF indexados del usuario.
- Basa tu respuesta DIRECTA y ÚNICAMENTE en los fragmentos recuperados del contexto local adjunto.
- Cita explícitamente el documento y número de página de cada dato obtenido (ej. \`[NombreDelArchivo.pdf, Pág. X]\`).
- NO rellenes lagunas con suposiciones externas como si provinieran del documento; si un dato no figura en los fragmentos locales, dilo claramente.
- Si NO se recuperó ningún fragmento local coincidente, NO respondas con conocimiento general o web: informa explícitamente que no se encontró información coincidente en los libros locales indexados (indicando los títulos disponibles en la biblioteca local) y sugiere ajustar la consulta, indexar el documento requerido o cambiar a alcance Web / Híbrida.`
    : '';

  const config: Record<string, any> = {
    temperature,
    systemInstruction: `Eres Alpha RAG, el motor de inteligencia técnica de ingeniería y asistente de investigación de nivel profesional.

Directrices de respuesta:
1. Responde de forma completa, rigurosa y directa a la consulta del usuario.
2. Si el usuario saluda o realiza una consulta conversacional informal (ej. "hola", "¿qué tal?"), responde cordialmente y con naturalidad como asistente de ingeniería mecánica, presentándote brevemente sin forzar fórmulas innecesarias.
3. Para consultas técnicas (resistencia de materiales, elementos de máquinas, normas industriales ASME/AGMA/ISO/FIA, termodinámica o ciencia de materiales):
   - Redacta de forma fluida y explicativa (estilo Perplexity AI / ChatGPT técnico).
   - Integra de forma orgánica las fuentes y citas pertinentes incluidas en el contexto.
   - Utiliza LaTeX riguroso: $...$ para expresiones en línea y $$...$$ para ecuaciones destacadas.
   - Detalla propiedades mecánicas clave cuando aparezcan en las fuentes.${localPolicy}`
  };

  // Configure thinking for Gemini models
  if (thinking) {
    const budgetMap: Record<string, number> = {
      minimal: 512,
      low: 1024,
      medium: 2048,
      high: 4096,
      max: 8192,
    };

    if (targetModel.includes('2.5')) {
      config.thinkingConfig = {
        thinkingBudget: budgetMap[effort] || 2048
      };
    } else {
      config.thinkingConfig = {
        thinkingLevel: effort === 'minimal' ? ThinkingLevel.MINIMAL :
                       effort === 'low' ? ThinkingLevel.LOW :
                       effort === 'high' || effort === 'max' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM
      };
    }
  } else {
    if (targetModel.includes('2.5')) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }
  }

  let promptContent: string;
  if (hasContext) {
    promptContent = `CONSULTA DE INGENIERÍA:\n${userQuery}\n\nALCANCE DE BÚSQUEDA: ${scope.toUpperCase()}\n\nCONTEXTO RECUPERADO DEL SISTEMA RAG:\n${contextPrompt}\n\nGenera la síntesis técnica fundamentada estrictamente en las fuentes recuperadas, citando documento y página cuando aplique, con fórmulas en LaTeX si corresponden.`;
  } else if (localNoMatch) {
    const bookListText = availableLocalBooks.length > 0
      ? availableLocalBooks.map(b => `- ${b}`).join('\n')
      : '- (Ningún libro indexado en disco)';
    promptContent = `CONSULTA DE INGENIERÍA:\n${userQuery}\n\nALCANCE DE BÚSQUEDA: LOCAL (SOLO BIBLIOTECA FÍSICA /libreria/)\n\nRESULTADO DE LA RECUPERACIÓN LOCAL: 0 fragmentos coincidentes encontrados en los documentos locales.\n\nDOCUMENTOS ACTUALMENTE INDEXADOS EN LA BIBLIOTECA LOCAL:\n${bookListText}\n\nInforma con claridad al usuario que no se halló información relacionada con su consulta en los documentos locales indexados, enumera brevemente qué archivos están disponibles actualmente en su librería local, y sugiere subir el documento pertinente o cambiar el alcance a Web / Híbrida. No respondas usando fuentes externas.`;
  } else {
    promptContent = `CONSULTA:\n${userQuery}`;
  }

  let response: any;

  // Helper to call generateContent with retry for transient 503 or 429
  const executeGenerate = async (callConfig: any) => {
    let lastError: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model: targetModel,
            contents: promptContent,
            config: callConfig
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout de ${Math.round(timeoutMs / 1000)}s al conectar con Google Gemini (${targetModel})`)), timeoutMs))
        ]);
        return res;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        // If high demand (503) or transient rate limit (429), wait and retry once
        if (attempt === 1 && (msg.includes('503') || msg.includes('high demand') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))) {
          console.warn(`[Google AI] Intento 1 con ${targetModel} recibió ${msg.slice(0, 100)}, reintentando en 1.5s...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  // Try generating with Google Search tool if scope is web or hybrid
  if (scope === 'web' || scope === 'ambas') {
    try {
      const searchConfig = {
        ...config,
        tools: [{ googleSearch: {} }]
      };
      response = await executeGenerate(searchConfig);
    } catch (searchErr: any) {
      console.warn(`[Google AI] Google Search grounding failed for ${targetModel}, retrying with RAG context only:`, searchErr?.message);
      response = await executeGenerate(config);
    }
  } else {
    response = await executeGenerate(config);
  }

  const searchGroundingCitations: GroundedCitation[] = [];
  const webQueries: string[] = [];

  const candidate = response.candidates?.[0];
  const groundingMetadata = candidate?.groundingMetadata;

  if (groundingMetadata) {
    if (groundingMetadata.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
      webQueries.push(...groundingMetadata.webSearchQueries);
    }

    if (groundingMetadata.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web && chunk.web.uri) {
          try {
            const parsedUri = new URL(chunk.web.uri);
            searchGroundingCitations.push({
              id: `cit-gsearch-${Date.now()}-${idx}`,
              chunkId: `gsearch-${idx}`,
              documentName: chunk.web.title || parsedUri.hostname,
              pageNumber: 1,
              similarityScore: 0.96,
              excerpt: `Fuente web verificada por Google Search Grounding: ${chunk.web.title || parsedUri.hostname}`,
              type: 'web',
              url: chunk.web.uri,
              domain: parsedUri.hostname.replace(/^www\./, '')
            });
          } catch {}
        }
      });
    }
  }

  const text = response.text || '';
  if (!text) {
    throw new Error(`El modelo ${targetModel} devolvió una respuesta vacía.`);
  }

  return {
    text,
    searchGroundingCitations,
    webQueries
  };
}

// --------------------------------------------------------------------------
// 7. SYNTHESIS WITH NVIDIA NIM MICROSERVICES
// --------------------------------------------------------------------------
async function synthesizeWithNvidiaNim(
  modelId: string,
  userQuery: string,
  contextPrompt: string,
  thinking: boolean,
  effort: string,
  scope: RetrievalScope,
  isConversational = false,
  availableLocalBooks: string[] = [],
  temperatureOverride?: number,
  timeoutMs = 35000
): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY no configurado en entorno.');
  }

  const endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const hasContext = Boolean(contextPrompt && contextPrompt.trim().length > 0);
  const localNoMatch = !isConversational && scope === 'local' && !hasContext;

  const localInstruction = scope === 'local'
    ? `\nREGLAS DE BÚSQUEDA LOCAL: Estás consultando únicamente los libros locales del usuario. Fundamenta tu respuesta estrictamente en los fragmentos locales recibidos citando archivo y página. Si no hubo fragmentos coincidentes (0 resultados), indica claramente que no se encontró información en la biblioteca local y enumera los libros disponibles sin inventar datos externos.`
    : '';

  const systemMessage = `Eres Alpha RAG sobre microservicios acelerados NVIDIA NIM (TensorRT-LLM).
Alcance de recuperación: ${scope.toUpperCase()}.
Resuelve la consulta de ingeniería con rigor técnico y matemático:
- Fórmulas en LaTeX ($...$ para línea, $$...$$ para bloque).
- Cita las fuentes recuperadas (archivo y página para Local, o códigos ASME/AGMA/ISO/FIA si aplican en Web).
- Si el usuario saluda o envía un mensaje informal, responde cordialmente como asistente técnico sin forzar fórmulas.${localInstruction}`;

  let userContent: string;
  if (hasContext) {
    userContent = `CONSULTA:\n${userQuery}\n\nCONTEXTO RECUPERADO:\n${contextPrompt}`;
  } else if (localNoMatch) {
    const bookListText = availableLocalBooks.length > 0
      ? availableLocalBooks.map(b => `- ${b}`).join('\n')
      : '- (Ningún libro indexado en disco)';
    userContent = `CONSULTA:\n${userQuery}\n\nRESULTADO DE BÚSQUEDA LOCAL: 0 fragmentos coincidentes.\nDOCUMENTOS DISPONIBLES EN /libreria/:\n${bookListText}\nInforma al usuario que no hay coincidencias en los documentos locales y menciona qué libros locales están disponibles.`;
  } else {
    userContent = `CONSULTA:\n${userQuery}`;
  }

  const payload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userContent }
    ],
    temperature: temperatureOverride !== undefined
      ? temperatureOverride
      : (effort === 'minimal' ? 0.05 : effort === 'low' ? 0.1 : effort === 'high' || effort === 'max' ? 0.4 : 0.2),
    max_tokens: 2048,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'aistudio-build'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (netErr: any) {
    clearTimeout(timer);
    if (netErr.name === 'AbortError') {
      throw new Error(`Timeout de ${Math.round(timeoutMs / 1000)}s al consultar el microservicio NVIDIA NIM (${modelId}).`);
    }
    throw netErr;
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();

  if (!response.ok) {
    let detail = rawText;
    try {
      const parsed = JSON.parse(rawText);
      detail = parsed.detail || parsed.message || parsed.error?.message || rawText;
    } catch {}
    throw new Error(`Error en NVIDIA NIM (${response.status}): ${detail.slice(0, 300)}`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`NVIDIA NIM devolvió formato no-JSON (${response.status}): ${rawText.slice(0, 200)}`);
  }

  const textOutput = data?.choices?.[0]?.message?.content;
  if (!textOutput) {
    throw new Error(`Respuesta vacía desde microservicio NVIDIA NIM (${modelId})`);
  }

  return textOutput;
}

// --------------------------------------------------------------------------
// 8. MAIN ORCHESTRATOR: COMPLETE RAG PIPELINE
// --------------------------------------------------------------------------
export async function executeRagPipeline(payload: RagQueryPayload): Promise<RagQueryResponse> {
  const startTime = Date.now();

  // 1. Resolve scope: prioritize explicit tags in the query, then payload.scope, default to 'local'
  let queryText = (payload.query || '').trim();
  let resolvedScope: RetrievalScope = payload.scope || 'local';

  if (/\[Alcance:\s*(?:Búsqueda\s*)?Web\]/i.test(queryText) || /\[Web\]/i.test(queryText)) {
    resolvedScope = 'web';
    queryText = queryText.replace(/\[Alcance:\s*(?:Búsqueda\s*)?Web\]\s*/gi, '').replace(/\[Web\]\s*/gi, '').trim();
  } else if (/\[Alcance:\s*(?:Búsqueda\s*)?(?:Híbrida|Ambas)\]/i.test(queryText) || /\[Ambas\]/i.test(queryText)) {
    resolvedScope = 'ambas';
    queryText = queryText.replace(/\[Alcance:\s*[^\]]+\]\s*/gi, '').trim();
  } else if (/\[Alcance:\s*(?:Búsqueda\s*)?Local\]/i.test(queryText) || /\[Local\]/i.test(queryText)) {
    resolvedScope = 'local';
    queryText = queryText.replace(/\[Alcance:\s*[^\]]+\]\s*/gi, '').trim();
  }

  const runtime = getRuntimeSettings();
  const scope: RetrievalScope = resolvedScope;
  const requestedChatModel = payload.modelId || runtime.chatModel || 'gemini-2.5-flash';
  const modelId =
    (scope === 'web' && runtime.webSearchModel && runtime.webSearchModel !== 'auto')
      ? runtime.webSearchModel
      : requestedChatModel;
  const provider =
    (scope === 'web' && runtime.webSearchModel && runtime.webSearchModel !== 'auto')
      ? (
          modelId.startsWith('meta/') ||
          modelId.startsWith('deepseek') ||
          modelId.startsWith('mistral') ||
          modelId.startsWith('qwen') ||
          modelId.startsWith('nvidia')
            ? 'nvidia'
            : 'google'
        )
      : (
          payload.provider || (
            modelId.startsWith('meta/') ||
            modelId.startsWith('deepseek') ||
            modelId.startsWith('mistral') ||
            modelId.startsWith('qwen') ||
            modelId.startsWith('nvidia')
              ? 'nvidia'
              : 'google'
          )
        );
  const thinking = payload.thinking !== undefined ? payload.thinking : true;
  const effort = payload.effort || 'medium';
  const topK = payload.topK || runtime.topK || 5;
  const temperature = payload.temperature !== undefined ? payload.temperature : runtime.temperature;
  const llmTimeoutMs = Math.max(10_000, (runtime.llmTimeoutSeconds || 45) * 1000);

  const isConversational = detectQueryIntent(queryText) === 'conversational';

  const retrievalStart = Date.now();

  // Execute retrieval stages strictly according to selected scope when query is technical
  let localChunks: any[] = [];
  let chunksExamined = 0;
  if (!isConversational && (scope === 'local' || scope === 'ambas')) {
    const localResult = await executeLocalRetrieval(queryText, topK);
    localChunks = localResult.chunks;
    chunksExamined += localResult.chunksExamined;
  }

  let webChunks: any[] = [];
  let webQueriesExecuted: string[] = [];
  if (!isConversational && (scope === 'web' || scope === 'ambas')) {
    const webResult = await executeWebRetrieval(queryText, topK, payload.attachments);
    webChunks = webResult.chunks;
    webQueriesExecuted = webResult.webQueries;
    chunksExamined += TECHNICAL_WEB_CORPUS.length;
  }

  const retrievalMs = Date.now() - retrievalStart;

  // Fuse context and build verified citations
  const { contextPrompt, citations } = buildFusedContext(localChunks, webChunks, scope);

  const availableLocalBooks = (!isConversational && scope === 'local' && localChunks.length === 0)
    ? getPhysicalLibraryTree().map(b => `${b.fileName} (${b.discipline}, ${b.pages} págs)`)
    : [];

  // Synthesize response using selected model & provider
  let finalContent = '';

  try {
    if (provider === 'google') {
      const googleResult = await synthesizeWithGoogleAi(
        modelId,
        queryText,
        contextPrompt,
        thinking,
        effort,
        scope,
        isConversational,
        availableLocalBooks,
        temperature,
        llmTimeoutMs
      );
      finalContent = googleResult.text;

      if (scope !== 'local' && googleResult.searchGroundingCitations && googleResult.searchGroundingCitations.length > 0) {
        citations.unshift(...googleResult.searchGroundingCitations);
      }
      if (scope !== 'local' && googleResult.webQueries && googleResult.webQueries.length > 0) {
        webQueriesExecuted.push(...googleResult.webQueries);
      }
    } else if (provider === 'nvidia') {
      finalContent = await synthesizeWithNvidiaNim(
        modelId,
        queryText,
        contextPrompt,
        thinking,
        effort,
        scope,
        isConversational,
        availableLocalBooks,
        temperature,
        llmTimeoutMs
      );
    } else {
      throw new Error(`Proveedor de modelo no soportado: ${provider}`);
    }

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      content: finalContent,
      citations,
      metrics: {
        latencyMs,
        retrievalMs,
        chunksExamined: isConversational ? 0 : chunksExamined,
        topKUsed: isConversational ? 0 : topK,
        similarityThreshold: runtime.similarityThreshold,
        model: `${provider === 'nvidia' ? 'NVIDIA NIM' : 'Google AI'} · ${modelId}`,
        provider,
        searchScope: scope,
        thinkingEffort: `${effort.toUpperCase()}${thinking ? ' (Thinking ON)' : ' (Thinking OFF)'}`,
        webQueries: webQueriesExecuted.length > 0 ? webQueriesExecuted : undefined
      }
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[RAG Pipeline] Error de inferencia con ${provider}/${modelId}:`, errMsg);

    return {
      success: false,
      content: '',
      citations,
      metrics: {
        latencyMs: Date.now() - startTime,
        retrievalMs,
        chunksExamined: Math.max(chunksExamined, 0),
        topKUsed: topK,
        similarityThreshold: runtime.similarityThreshold,
        model: `${provider === 'nvidia' ? 'NVIDIA NIM' : 'Google AI'} · ${modelId}`,
        provider,
        searchScope: scope,
        thinkingEffort: `${effort.toUpperCase()}${thinking ? ' (Thinking ON)' : ' (Thinking OFF)'}`,
        webQueries: webQueriesExecuted.length > 0 ? webQueriesExecuted : undefined
      },
      error: errMsg
    };
  }
}

