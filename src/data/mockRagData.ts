import { DocumentSource, ChunkItem, RagMessage, ChatSession } from '../types/rag';

export const SAMPLE_DOCUMENTS: DocumentSource[] = [
  {
    id: 'doc-hibbeler',
    name: 'Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed.pdf',
    title: 'Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed',
    fileName: 'Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed.pdf',
    pages: 672,
    chunksCount: 1840,
    size: '48.1 MB',
    uploadDate: '2026-11-06 18:20',
    status: 'indexed',
    author: 'R. C. Hibbeler',
    category: 'Ingeniería Mecánica Estática',
    vectorModel: 'text-embedding-004 (768-dim)',
    isExample: false,
  },
  {
    id: 'doc-shigley',
    name: 'shigley-10.pdf',
    title: 'Diseño en Ingeniería Mecánica',
    fileName: 'shigley-10.pdf',
    pages: 1088,
    chunksCount: 2420,
    size: '48.2 MB',
    uploadDate: '2026-11-05 12:10',
    status: 'indexed',
    author: 'Richard G. Budynas, J. Keith Nisbett',
    category: 'Diseño en Ingeniería Mecánica',
    vectorModel: 'text-embedding-004 (768-dim)',
    isExample: true,
  },
  {
    id: 'doc-cengel',
    name: 'cengel-termo-9.pdf',
    title: 'Termodinámica',
    fileName: 'cengel-termo-9.pdf',
    pages: 1024,
    chunksCount: 2190,
    size: '54.1 MB',
    uploadDate: '2026-11-04 16:45',
    status: 'indexed',
    author: 'Yunus A. Çengel, Michael A. Boles',
    category: 'Termodinámica',
    vectorModel: 'text-embedding-004 (768-dim)',
    isExample: true,
  },
  {
    id: 'doc-beer',
    name: 'beer-mecanica-11.pdf',
    title: 'Mecánica de Materiales',
    fileName: 'beer-mecanica-11.pdf',
    pages: 896,
    chunksCount: 1980,
    size: '39.8 MB',
    uploadDate: '2026-11-03 09:30',
    status: 'indexed',
    author: 'Ferdinand P. Beer, E. Russell Johnston Jr.',
    category: 'Mecánica de Materiales',
    vectorModel: 'text-embedding-004 (768-dim)',
    isExample: true,
  },
  {
    id: 'doc-mott',
    name: 'mott-diseno-mec-5.pdf',
    title: 'Elementos de Máquinas en el Diseño Mecánico',
    fileName: 'mott-diseno-mec-5.pdf',
    pages: 840,
    chunksCount: 1750,
    size: '44.6 MB',
    uploadDate: '2026-11-02 14:15',
    status: 'indexed',
    author: 'Robert L. Mott, Edward M. Vavrek, Jyhwen Wang',
    category: 'Diseño Mecánico & Máquinas',
    vectorModel: 'text-embedding-004 (768-dim)',
    isExample: true,
  },
];

export const SAMPLE_CHUNKS: ChunkItem[] = [
  {
    id: 'chunk-101',
    documentId: 'doc-1',
    documentName: 'Arquitectura_Empresarial_Microservicios_2026.pdf',
    pageNumber: 14,
    chunkIndex: 42,
    sectionTitle: '3.4 Resiliencia y Failover Automático en Clústeres Kubernetes',
    text: 'El subsistema de enrutamiento implementa un patrón Circuit Breaker con tiempo de espera adaptativo de 450ms. Ante caídas repetidas del servicio transaccional (más del 12% de errores en una ventana móvil de 10s), el tráfico se redirige automáticamente al clúster de contingencia réplica caliente ubicado en la región us-central1 sin pérdida de sesión gracias a la replicación asíncrona de estado en memoria.',
    similarity: 0.948,
    tokenCount: 78,
    vectorPreview: [0.0821, -0.421, 0.7712, 0.1294, -0.0418, 0.5129, 0.3391, -0.2184],
    category: 'Arquitectura',
    coordinates: { x: 28, y: 35 },
  },
  {
    id: 'chunk-102',
    documentId: 'doc-1',
    documentName: 'Arquitectura_Empresarial_Microservicios_2026.pdf',
    pageNumber: 19,
    chunkIndex: 58,
    sectionTitle: '4.2 Estrategia de Caché Multinivel y Control de Concurrencia',
    text: 'Para optimizar la latencia p99 por debajo de 35ms, se estructura una jerarquía L1 (in-process LRU en Go) y L2 (Redis Cluster distribuido con topología de 6 nodos shards). Las claves se invalidan mediante eventos pub/sub emitidos por Debezium CDC con un retardo promedio de propagación de 14ms.',
    similarity: 0.912,
    tokenCount: 72,
    vectorPreview: [0.1142, -0.389, 0.6921, 0.2014, -0.0811, 0.4871, 0.2918, -0.1983],
    category: 'Arquitectura',
    coordinates: { x: 34, y: 40 },
  },
  {
    id: 'chunk-201',
    documentId: 'doc-2',
    documentName: 'Acuerdo_Marco_SLA_Cloud_Enterprise.pdf',
    pageNumber: 7,
    chunkIndex: 21,
    sectionTitle: 'Cláusula 5.2 - Disponibilidad del Servicio y Compensaciones Económicas',
    text: 'El Proveedor garantiza un tiempo de disponibilidad mensual del 99.95% (excluyendo ventanas de mantenimiento preventivo notificadas con 72 horas de anticipación). Si el uptime desciende por debajo del 99.90%, el Cliente tendrá derecho a un crédito por servicio equivalente al 15% del canon mensual facturado.',
    similarity: 0.884,
    tokenCount: 64,
    vectorPreview: [-0.3421, 0.612, 0.1412, -0.4294, 0.1982, -0.1129, -0.4291, 0.3184],
    category: 'Legal & SLA',
    coordinates: { x: 74, y: 25 },
  },
  {
    id: 'chunk-202',
    documentId: 'doc-2',
    documentName: 'Acuerdo_Marco_SLA_Cloud_Enterprise.pdf',
    pageNumber: 11,
    chunkIndex: 33,
    sectionTitle: 'Cláusula 8.1 - Límites de Responsabilidad y Cifrado de Datos',
    text: 'Toda información clasificada como confidencial o PII deberá almacenarse cifrada en reposo mediante el algoritmo AES-256-GCM y transmitirse bajo protocolos TLS 1.3 con rotación semestral obligatoria de certificados. La responsabilidad máxima acumulada no excederá el importe abonado en los últimos 12 meses.',
    similarity: 0.865,
    tokenCount: 68,
    vectorPreview: [-0.2911, 0.584, 0.1981, -0.3912, 0.2104, -0.1418, -0.3812, 0.2914],
    category: 'Legal & SLA',
    coordinates: { x: 68, y: 32 },
  },
  {
    id: 'chunk-301',
    documentId: 'doc-3',
    documentName: 'Benchmark_Cuantitativo_LLM_RAG_v3.pdf',
    pageNumber: 22,
    chunkIndex: 84,
    sectionTitle: '5.1 Comparativa de Estrategias de Chunking Semántico vs Token Fijo',
    text: 'En evaluaciones con datasets de documentos normativos densos, el chunking semántico basado en cortes sintácticos y delimitadores de encabezados Markdown redujo las alucinaciones en un 27.4% en comparación con ventanas fijas de 512 tokens. El recall en Top-5 mejoró de 0.761 a 0.894 usando embeddings normalizados de 768 dimensiones.',
    similarity: 0.962,
    tokenCount: 76,
    vectorPreview: [0.5124, 0.119, -0.4219, 0.7812, 0.3291, 0.1482, -0.0912, 0.6214],
    category: 'Investigación AI',
    coordinates: { x: 48, y: 72 },
  },
  {
    id: 'chunk-302',
    documentId: 'doc-3',
    documentName: 'Benchmark_Cuantitativo_LLM_RAG_v3.pdf',
    pageNumber: 28,
    chunkIndex: 112,
    sectionTitle: '6.3 Impacto de Reranking con Modelos Cross-Encoder',
    text: 'La integración de una etapa intermedia de reranking con bge-reranker-large tras la recuperación inicial HNSW aumentó la precisión MRR@10 en 14.8 puntos porcentuales con un incremento insignificante de 22ms en la latencia total del pipeline.',
    similarity: 0.931,
    tokenCount: 62,
    vectorPreview: [0.4912, 0.145, -0.3814, 0.7419, 0.3012, 0.1294, -0.0718, 0.5982],
    category: 'Investigación AI',
    coordinates: { x: 55, y: 78 },
  },
  {
    id: 'chunk-103',
    documentId: 'doc-1',
    documentName: 'Arquitectura_Empresarial_Microservicios_2026.pdf',
    pageNumber: 31,
    chunkIndex: 94,
    sectionTitle: '5.5 Observabilidad Distribuida: OpenTelemetry y Muestreo Adaptativo',
    text: 'El rastreo de solicitudes utiliza propagación W3C Trace Context con OpenTelemetry Collector. Para mitigar el volumen de almacenamiento de trazas en picos de tráfico, se aplica muestreo basado en cola (tail-based sampling) reteniendo el 100% de trazas que contengan errores HTTP 5xx o latencias superiores a 500ms.',
    similarity: 0.841,
    tokenCount: 70,
    vectorPreview: [0.1421, -0.312, 0.5912, 0.1812, -0.0219, 0.4219, 0.2812, -0.1542],
    category: 'Arquitectura',
    coordinates: { x: 22, y: 46 },
  },
  {
    id: 'chunk-303',
    documentId: 'doc-3',
    documentName: 'Benchmark_Cuantitativo_LLM_RAG_v3.pdf',
    pageNumber: 37,
    chunkIndex: 148,
    sectionTitle: '7.2 Cuantización Vectorial PQ e Indexación HNSW en Memoria',
    text: 'La cuantización de producto (Product Quantization PQ8) permitió compactar el espacio vectorial en un 75% manteniendo una pérdida de fidelidad menor a 1.2% en similitud de coseno, habilitando 5 millones de vectores en nodos de memoria de 32GB con búsqueda sub-milisegundo.',
    similarity: 0.895,
    tokenCount: 69,
    vectorPreview: [0.5412, 0.089, -0.4612, 0.8129, 0.3612, 0.1821, -0.1192, 0.6514],
    category: 'Investigación AI',
    coordinates: { x: 62, y: 68 },
  },
  {
    id: 'chunk-hib-1',
    documentId: 'doc-hibbeler',
    documentName: 'Ingenieria Mecanica Estatica - R C Hibbeler 12ma Ed.pdf',
    pageNumber: 142,
    chunkIndex: 512,
    sectionTitle: '5.3 Condiciones de Equilibrio para un Cuerpo Rígido en Dos Dimensiones',
    text: 'Para que un cuerpo rígido se encuentre en equilibrio estático bajo un sistema coplanar de fuerzas, la fuerza resultante y el momento resultante con respecto a cualquier punto O deben ser iguales a cero: ΣFx = 0, ΣFy = 0, y ΣMO = 0. En armaduras planas, el principio de transmisibilidad y el diagrama de cuerpo libre (DCL) constituyen la base analítica fundamental para determinar reacciones de soporte en apoyos articulados y de rodillo.',
    similarity: 0.952,
    tokenCount: 84,
    vectorPreview: [0.2415, -0.189, 0.6312, 0.3129, -0.1148, 0.4912, 0.3124, -0.1842],
    category: 'Ingeniería Mecánica Estática',
    coordinates: { x: 38, y: 52 },
  },
  {
    id: 'chunk-shig-1',
    documentId: 'doc-shigley',
    documentName: 'shigley-10.pdf',
    pageNumber: 288,
    chunkIndex: 720,
    sectionTitle: '6.12 Criterios de Falla por Fatiga: Diagrama de Goodman Modificado',
    text: 'En el diseño bajo esfuerzos fluctuantes cíclicos, la línea de Goodman modificada correlaciona el esfuerzo alternante σa y el esfuerzo medio σm con el límite de resistencia a la fatiga Se y la resistencia a la tensión Sut: (σa / Se) + (σm / Sut) = 1/n. Se complementa con la línea de fluencia de Langevin/Gerber para evitar deformación plástica localizada en el primer cuarto de ciclo.',
    similarity: 0.941,
    tokenCount: 78,
    vectorPreview: [0.3812, 0.214, -0.1982, 0.6214, 0.1842, 0.3912, -0.2184, 0.5124],
    category: 'Diseño en Ingeniería Mecánica',
    coordinates: { x: 42, y: 64 },
  },
  {
    id: 'chunk-ceng-1',
    documentId: 'doc-cengel',
    documentName: 'cengel-termo-9.pdf',
    pageNumber: 176,
    chunkIndex: 430,
    sectionTitle: '4.2 Balance de Energía para Sistemas Cerrados y Primera Ley',
    text: 'El cambio en la energía total de un sistema cerrado estacionario equivale a la transferencia neta de calor menos el trabajo realizado durante el proceso: Qneto - Wneto = ΔU = m * cv * (T2 - T1). Para un gas ideal con calores específicos constantes, la variación de entalpía ΔH depende exclusivamente del diferencial térmico ΔT.',
    similarity: 0.934,
    tokenCount: 72,
    vectorPreview: [-0.1821, 0.4912, 0.3412, -0.2814, 0.4129, -0.0912, 0.1842, -0.3214],
    category: 'Termodinámica',
    coordinates: { x: 58, y: 38 },
  },
  {
    id: 'chunk-beer-1',
    documentId: 'doc-beer',
    documentName: 'beer-mecanica-11.pdf',
    pageNumber: 312,
    chunkIndex: 610,
    sectionTitle: '7.4 Teorías de Falla bajo Cargas Combinadas: Criterio de Von Mises',
    text: 'La teoría de la máxima energía de distorsión (criterio de Von Mises) establece que la fluencia en un material dúctil ocurre cuando el esfuerzo efectivo σe = sqrt(σ1^2 - σ1*σ2 + σ2^2) iguala el límite elástico de fluencia Sy en tracción uniaxial. Proporciona una correlación un 15% más precisa en aceros estructurales frente a la teoría del esfuerzo cortante máximo de Tresca.',
    similarity: 0.925,
    tokenCount: 82,
    vectorPreview: [0.1924, -0.3812, 0.4819, 0.1412, -0.2912, 0.5812, 0.2214, -0.1482],
    category: 'Mecánica de Materiales',
    coordinates: { x: 49, y: 45 },
  },
  {
    id: 'chunk-mott-1',
    documentId: 'doc-mott',
    documentName: 'mott-diseno-mec-5.pdf',
    pageNumber: 420,
    chunkIndex: 580,
    sectionTitle: '8.5 Geometría y Fuerzas en Engranes Rectos con Ángulo de Presión de 20°',
    text: 'La fuerza tangencial transmitida Wt = (60000 * P) / (π * d * n) determina el momento torsional actuante en el piñón. La componente radial Wr = Wt * tan(φ) induce flexión en el eje de transmisión y carga pura en los rodamientos de bolas de ranura profunda, requiriendo verificación del factor geométrico J de la AGMA.',
    similarity: 0.918,
    tokenCount: 79,
    vectorPreview: [0.4124, 0.0912, -0.3129, 0.6912, 0.2418, 0.2912, -0.1412, 0.4812],
    category: 'Diseño Mecánico & Máquinas',
    coordinates: { x: 52, y: 59 },
  },
];

export const INITIAL_MESSAGES: RagMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: '¿Cuál es el mecanismo de **tolerancia a fallos** y **failover** ante caídas del servicio transaccional según la arquitectura?',
    timestamp: '14:24',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: `De acuerdo con la documentación técnica de **Arquitectura Empresarial de Microservicios 2026** (Capítulo 3, pág. 14), el sistema cuenta con un protocolo robusto de resiliencia estructurado en los siguientes pilares:

### 1. Patrón Circuit Breaker Adaptativo
* **Umbral de Activación:** Se evalúa una ventana móvil de **10 segundos**; si el ratio de errores excede el **12%**, el circuito conmuta a estado \`OPEN\`.
* **Tiempo de Espera:** Cuenta con un timeout dinámico configurado en **450 ms**.

\`\`\`yaml
# Configuración del Circuit Breaker en Istio / Envoy Gateway
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: transactional-service-resilience
spec:
  host: transactional-core.prod.svc.cluster.local
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 100
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
\`\`\`

### 2. Desvío y Conmutación Caliente (Failover)
* El tráfico se redirige de manera automatizada al **clúster de contingencia réplica caliente** ubicado en la región **\`us-central1\`**.
* La continuidad de sesión para usuarios activos está garantizada gracias al mecanismo de **replicación asíncrona de estado en memoria**.

### 3. Matriz de Resiliencia y Parámetros Operativos

| Parámetro Operativo | Valor Nominal | Umbral de Degrado | Región de Contingencia |
| :--- | :--- | :--- | :--- |
| **Latencia p99** | \`< 35 ms\` | \`> 450 ms\` (failover) | \`us-central1\` |
| **Tolerancia a Fallos** | \`99.95% uptime\` | \`> 12% errores / 10s\` | Réplica caliente sincronizada |
| **Caché Distribuida** | L1 LRU Go in-process | L2 Redis 6 shards | Replicación CDC Debezium |

> **Nota de Arquitectura:** El sistema previene el efecto en cascada aguas abajo aislando pools de conexión y degradando temporalmente funcionalidades accesorias a modo de solo lectura mientras se restablece el pod principal.`,
    timestamp: '14:25',
    citations: [
      {
        id: 'cit-1',
        chunkId: 'chunk-101',
        documentName: 'Arquitectura_Empresarial_Microservicios_2026.pdf',
        pageNumber: 14,
        similarityScore: 0.948,
        excerpt: 'El subsistema de enrutamiento implementa un patrón Circuit Breaker con tiempo de espera adaptativo de 450ms...',
      },
      {
        id: 'cit-2',
        chunkId: 'chunk-102',
        documentName: 'Arquitectura_Empresarial_Microservicios_2026.pdf',
        pageNumber: 19,
        similarityScore: 0.912,
        excerpt: 'Para optimizar la latencia p99 por debajo de 35ms, se estructura una jerarquía L1 y L2 con Redis...',
      },
    ],
    metrics: {
      latencyMs: 312,
      retrievalMs: 41,
      chunksExamined: 142,
      topKUsed: 5,
      similarityThreshold: 0.82,
      model: 'Embedding-004 + Gemini Pro RAG Synthesizer',
    },
  },
];

export const PRESET_PROMPTS = [
  '¿Cuál es la política de SLA Cloud? Detállala con una **tabla comparativa** y créditos de penalización.',
  '¿Cómo funciona el Circuit Breaker y failover? Muestra un ejemplo de **configuración YAML**.',
  '¿Cuáles son las ventajas del **chunking semántico** frente a tokens fijos según el benchmark?',
  '¿Cómo se estructura la jerarquía de **caché L1/L2** para mantener la latencia p99 < 35ms?',
];

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Tolerancia a fallos y Failover',
    createdAt: '2026-11-07 14:24',
    updatedAt: '2026-11-07 14:25',
    messages: INITIAL_MESSAGES,
  },
  {
    id: 'session-2',
    title: 'Garantías y Créditos SLA Cloud',
    createdAt: '2026-11-06 10:15',
    updatedAt: '2026-11-06 10:18',
    messages: [
      {
        id: 'msg-s2-1',
        role: 'user',
        content: '¿Cuál es la política de SLA Cloud? Detállala con una **tabla comparativa** y créditos de penalización.',
        timestamp: '10:15',
      },
      {
        id: 'msg-s2-2',
        role: 'assistant',
        content: `Con base en el **Acuerdo Marco SLA Cloud Enterprise** (Páginas 7 y 11), se estipulan los siguientes acuerdos contractuales:

### 1. Resumen de Niveles de Servicio (SLA)

| Cláusula | Métrica Garantizada | Penalización / Compensación | Excepciones |
| :--- | :--- | :--- | :--- |
| **5.2 Disponibilidad** | \`99.95%\` mensual | Crédito del \`15%\` si cae de 99.90% | Mantenimiento con 72h de preaviso |
| **8.1 Cifrado en Reposo** | \`AES-256-GCM\` | Responsabilidad hasta 12 meses canon | Llaves administradas HSM |
| **8.1 Tránsito** | Protocolo \`TLS 1.3\` | Rotación semestral de certificados | N/A |

### 2. Esquema de Compensación y Créditos
* **Garantía Mensual:** El proveedor garantiza un **99.95% de disponibilidad** ininterrumpida.
* **Ventanas de Mantenimiento:** Quedan excluidas las intervenciones notificadas formalmente con al menos **72 horas de anticipación**.
* **Créditos Automáticos:** Si el uptime es inferior al 99.90%, se aplica un crédito directo sobre la siguiente factura mensual.

> **Importante:** La responsabilidad acumulada del proveedor tiene un límite máximo equivalente al importe total facturado en los 12 meses anteriores al incidente.`,
        timestamp: '10:18',
        citations: [
          {
            id: 'cit-s2-1',
            chunkId: 'chunk-201',
            documentName: 'Acuerdo_Marco_SLA_Cloud_Enterprise.pdf',
            pageNumber: 7,
            similarityScore: 0.884,
            excerpt: 'El Proveedor garantiza un tiempo de disponibilidad mensual del 99.95%...',
          },
        ],
        metrics: {
          latencyMs: 288,
          retrievalMs: 34,
          chunksExamined: 64,
          topKUsed: 4,
          similarityThreshold: 0.80,
          model: 'Embedding-004 + Gemini Pro RAG Synthesizer',
        },
      },
    ],
  },
  {
    id: 'session-3',
    title: 'Benchmark Chunking Semántico',
    createdAt: '2026-11-05 16:30',
    updatedAt: '2026-11-05 16:34',
    messages: [
      {
        id: 'msg-s3-1',
        role: 'user',
        content: '¿Cuáles son las ventajas del **chunking semántico** frente a tokens fijos según el benchmark?',
        timestamp: '16:30',
      },
      {
        id: 'msg-s3-2',
        role: 'assistant',
        content: `Según el reporte **Benchmark Cuantitativo LLM RAG v3** (Capítulos 5 y 6):

### 1. Comparativa: Chunking Semántico vs Token Fijo

| Estrategia de Segmentación | Alucinaciones | Recall @ Top-5 | MRR @ 10 | Latencia Añadida |
| :--- | :--- | :--- | :--- | :--- |
| **Ventana Fija (512 tokens)** | Base (100%) | \`0.761\` | \`0.684\` | \`+0 ms\` |
| **Chunking Semántico .md** | **-27.4%** | **\`0.894\`** | \`0.812\` | \`+4 ms\` |
| **+ Reranking Cross-Encoder** | **-34.1%** | **\`0.928\`** | **\`+14.8 pts\`** | \`+22 ms\` |

> **Conclusión:** La conservación de la jerarquía sintáctica mediante delimitadores Markdown evita rotura de conceptos clave.`,
        timestamp: '16:34',
        citations: [
          {
            id: 'cit-s3-1',
            chunkId: 'chunk-301',
            documentName: 'Benchmark_Cuantitativo_LLM_RAG_v3.pdf',
            pageNumber: 22,
            similarityScore: 0.962,
            excerpt: 'En evaluaciones con datasets de documentos normativos densos, el chunking semántico...',
          },
        ],
        metrics: {
          latencyMs: 310,
          retrievalMs: 42,
          chunksExamined: 198,
          topKUsed: 5,
          similarityThreshold: 0.82,
          model: 'Embedding-004 + Gemini Pro RAG Synthesizer',
        },
      },
    ],
  },
];

