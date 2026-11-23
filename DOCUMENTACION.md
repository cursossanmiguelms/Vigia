# VigIA — Documento base del anteproyecto de Trabajo de Diploma

> **Nota de uso.** Este documento reúne toda la información disponible del proyecto **VigIA / VigIA**: código, arquitectura, funcionalidades, datos, parámetros, decisiones de diseño, estado actual y visión de producto. Está ordenado con encuadre de anteproyecto de tesis para que el autor —o una IA de apoyo— lo refine con sus propios parámetros académicos. Los campos marcados `[COMPLETAR]` o `[VERIFICAR]` requieren datos del autor, del tutor o de la institución.

---

## Portada

| Campo | Valor |
|---|---|
| **Título tentativo** | VigIA: plataforma de visión artificial local para el monitoreo de personas y la detección de equipos de protección personal en entornos industriales |
| **Tipo de documento** | Anteproyecto de Trabajo de Diploma |
| **Autor** | Daniel Valdes López |
| **Institución** | Instituto Superior Politécnico José Antonio Echeverría (CUJAE) |
| **Facultad** | Automática y Biomédica |
| **Carrera** | Ingeniería Automática |
| **Título a optar** | Ingeniero en Automática |
| **Tutor** | `[COMPLETAR]` |
| **Lugar** | La Habana, Cuba |
| **Curso académico** | 2026–2027 |
| **Año de la carrera** | 4to año (año terminal; carrera de 4 años) |
| **Versión del software documentada** | 0.4.0 |
| **Versión del documento** | 1.0 |
| **Fecha** | 11 de noviembre de 2026 |

---

## Índice

**Parte I — Encuadre académico**
1. Resumen ejecutivo
2. Ficha rápida del proyecto
3. Tema y título
4. Planteamiento del problema
5. Justificación
6. Objetivos
7. Alcance y delimitaciones
8. Marco teórico y estado del arte
9. Metodología
10. Descripción general de la solución
11. Recursos necesarios
12. Resultados esperados
13. Referencias preliminares

**Parte II — Dossier técnico completo**
14. Ficha técnica del repositorio
15. Arquitectura del sistema
16. Backend `server.py`
17. Detector `detector.py`
18. ReID por apariencia
19. API local
20. Variables de entorno
21. Capturas y dataset
22. Frontend y maqueta SaaS
23. Modelo de datos SaaS
24. Monitoreo, cámaras y zonas
25. Instalación y operación
26. Rendimiento
27. Pruebas realizadas y estado de validación
28. Privacidad, seguridad y ética
29. Limitaciones
30. Roadmap
31. Inventario de parámetros
32. Glosario
33. Anexos

---

# PARTE I — ENCUADRE ACADÉMICO

## 1. Resumen ejecutivo

**VigIA** es un proyecto de visión artificial local orientado al monitoreo de personas en entornos industriales y a la futura detección de equipos de protección personal (EPP). El sistema captura video desde un teléfono con DroidCam, lo procesa en una PC sin enviar imágenes a internet y muestra los resultados en una interfaz web: video en vivo, cajas alrededor de las personas, identificadores estables, conteo, métricas de rendimiento y eventos.

La versión funcional actual, **0.4.0**, implementa:

- Proxy local del stream MJPEG de DroidCam.
- Detección de personas con **YOLO11n** exportado a ONNX (entrada fija de 416 × 416).
- Seguimiento multiobjeto con **ByteTrack** e IDs estables.
- **Memoria de apariencia** (ReID heurístico por histogramas de color de la ropa) que devuelve el número a una persona que sale y vuelve a entrar dentro de 120 segundos.
- Capturas JPEG con metadatos para construir el dataset de EPP.
- Reconexión automática, búsqueda de la cámara en la red local, modo de prueba con archivos locales y API HTTP local.
- Una **maqueta navegable de plataforma SaaS** con portal público, login, consola de administrador y consola de empresa; incluye planes, empresas, usuarios, sesiones, auditoría, facturación y módulos de monitoreo, cámaras y zonas.

El procesamiento ocurre íntegramente en el equipo. El servidor escucha solo en `127.0.0.1`, no hay reconocimiento facial ni biometría, y el video no se transmite a servicios externos.

El anteproyecto propone consolidar este prototipo como una plataforma de apoyo a la seguridad laboral: agregar detección de EPP, zonas restringidas con alertas, métricas y validación experimental. El documento incluye el estado real del código, los parámetros exactos, las limitaciones y la hoja de ruta, de modo que sirva como base verificable para la tesis.

---

## 2. Ficha rápida del proyecto

| Dimensión | Descripción |
|---|---|
| **Nombre del proyecto** | VigIA |
| **Nombre de la plataforma** | VigIA |
| **Versión funcional** | 0.4.0 (`server.py`: `VERSION = "0.4.0"`) |
| **Estado** | Prototipo funcional + maqueta SaaS navegable |
| **Tipo de sistema** | Cliente-servidor local, monolítico, sin nube |
| **Lenguaje principal** | Python 3.10+ (probado con 3.14) |
| **Backend** | `http.server.ThreadingHTTPServer` de la biblioteca estándar |
| **Frontend** | HTML, CSS y JavaScript vanilla, sin framework ni build |
| **Modelo de detección** | YOLO11n (Ultralytics), exportado a ONNX |
| **Entrada del modelo** | 416 × 416 píxeles, clase `person` (COCO, id 0) |
| **Seguimiento** | ByteTrack de Ultralytics |
| **ReID** | Histogramas HSV de torso y cuerpo; comparación por coseno |
| **Runtime de inferencia** | ONNX Runtime (CPU) |
| **Cámara** | DroidCam por WiFi (MJPEG), puerto típico 4747 |
| **Servidor local** | `127.0.0.1:8000` por defecto |
| **Persistencia** | Archivos JSON/JPEG en `data/captures`; `localStorage` en la maqueta |
| **Base de datos** | No tiene |
| **Autenticación real** | No tiene; el login de la maqueta es demostrativo |
| **Privacidad** | Procesamiento local, sin envío a internet, sin rostros |
| **Licencia** | `[COMPLETAR: no hay archivo LICENSE en el repositorio]` |

---

## 3. Tema y título

### 3.1 Tema

Visión artificial aplicada a la seguridad laboral: detección y seguimiento de personas, reidentificación por apariencia y verificación de equipos de protección personal en entornos industriales, con procesamiento local de bajo costo.

### 3.2 Título propuesto

> **VigIA: plataforma de visión artificial local para el monitoreo de personas y la detección de equipos de protección personal en entornos industriales**

### 3.3 Alternativas de título

1. Sistema de visión artificial local para la seguridad laboral y la detección de EPP en entornos industriales.
2. Plataforma de monitoreo inteligente con visión artificial para la prevención de riesgos laborales.
3. Diseño e implementación de un sistema local de detección de personas y EPP basado en YOLO y seguimiento multiobjeto.

### 3.4 Línea de investigación

Automatización, control y supervisión de procesos; visión artificial; sistemas de percepción; seguridad y salud en el trabajo; computación en el borde (*edge computing*).

### 3.5 Justificación del título

El título nombra el producto (**VigIA**), precisa el enfoque (**visión artificial local**), delimita las dos funciones centrales (**monitoreo de personas** y **detección de EPP**) y establece el contexto (**entornos industriales**). No promete reconocimiento facial ni identificación biométrica, lo que es coherente con el alcance real y con las consideraciones éticas del proyecto.

---

## 4. Planteamiento del problema

### 4.1 Contexto

En plantas industriales, talleres, almacenes y obras de construcción, el cumplimiento del uso de EPP (casco, chaleco, guantes, gafas, protección auditiva y calzado) es una condición básica de seguridad. La supervisión suele ser manual: un responsable recorre las áreas o revisa cámaras de videovigilancia convencionales. Ese esquema tiene limitaciones:

- No cubre todos los puestos ni todos los turnos.
- Depende de la atención sostenida del operador.
- Genera registros tardíos o incompletos.
- No produce métricas objetivas para la mejora continua.
- Puede percibirse como vigilancia arbitraria si no hay reglas claras.

### 4.2 Problema técnico

Las soluciones comerciales de analítica de video suelen requerir:

- Conexión permanente a la nube y pago por suscripción.
- Cámaras IP dedicadas y hardware especializado.
- Ancho de banda estable.
- Contratos y condiciones que no siempre están al alcance de pequeñas empresas o instituciones.

En un contexto como el cubano, con conectividad limitada y equipos modestos, se necesita una alternativa que funcione **localmente**, con hardware reutilizable (una PC y un teléfono), software libre y bajo consumo de recursos.

### 4.3 Problema de investigación

¿Es posible diseñar e implementar una plataforma local de visión artificial, ejecutable en CPU y con hardware de bajo costo, que detecte y siga personas, mantenga identificadores estables y sirva de base para verificar el uso de EPP en entornos industriales, sin enviar video a internet ni usar reconocimiento facial?

### 4.4 Formulación

El proyecto parte de un prototipo funcional que ya resuelve la captura, la detección, el seguimiento y la reidentificación de personas. La tesis debe completar y validar la propuesta: incorporar la detección de EPP, definir zonas y alertas, establecer métricas de desempeño y demostrar su utilidad en escenarios controlados.

### 4.5 Árbol de problemas (síntesis)

```text
Supervisión manual insuficiente
        │
        ├── Cobertura parcial de áreas y turnos
        ├── Registros tardíos o ausentes
        ├── Falta de métricas objetivas
        └── Poca trazabilidad de incidentes
                │
                ▼
        Riesgo de accidentes y incumplimiento de EPP
                │
                ▼
        Necesidad de un monitoreo automático, local y de bajo costo
```

---

## 5. Justificación

### 5.1 Justificación técnica

- **Procesamiento local:** elimina la dependencia de la nube y reduce la latencia.
- **Hardware reutilizable:** usa una PC convencional y un teléfono con DroidCam como cámara.
- **CPU-only:** el modelo YOLO11n en ONNX funciona sin GPU; es adecuado para equipos modestos.
- **Arquitectura simple:** un servidor HTTP y un hilo de inferencia, sin contenedores ni servicios externos.
- **Modularidad:** separa captura, detección, seguimiento, ReID, interfaz y API.
- **Extensibilidad:** la maqueta SaaS y el roadmap prevén EPP, zonas, alertas, métricas y multiempresa.

### 5.2 Justificación económica

- Software 100 % open source: Python, OpenCV, Ultralytics, ONNX Runtime, ByteTrack.
- No hay suscripciones, licencias ni costos de nube.
- Se aprovechan equipos existentes: PC, teléfono, red WiFi.
- El costo marginal de agregar una cámara es bajo: otro teléfono con DroidCam o una cámara IP económica.

### 5.3 Justificación social

- Contribuye a la prevención de accidentes laborales.
- Objetiva el cumplimiento de EPP y reduce la subjetividad de la supervisión.
- Genera evidencia para capacitación y mejora continua.
- Puede operar sin identificar personas, lo que reduce la sensación de vigilancia invasiva.

### 5.4 Justificación ambiental

- Reutiliza hardware en lugar de promover su reemplazo.
- Reduce el consumo energético frente a servidores en la nube.
- Disminuye el tráfico de red al no transmitir video fuera de la instalación.

### 5.5 Justificación institucional y académica

- Se alinea con el perfil de Ingeniería Automática: sensores, adquisición, procesamiento, control y supervisión.
- Integra competencias de programación, electrónica, redes, visión artificial e inteligencia artificial.
- Fortalece la vinculación de la CUJAE con problemas reales de la industria.
- Deja una base documentada y reproducible para futuros trabajos de diploma.

### 5.6 Justificación personal

`[COMPLETAR: motivación del autor, experiencia previa, interés en visión artificial y seguridad industrial]`

---

## 6. Objetivos

### 6.1 Objetivo general

Diseñar, implementar y validar una plataforma local de visión artificial, ejecutable en CPU y con hardware de bajo costo, para el monitoreo de personas y la detección de equipos de protección personal en entornos industriales, sin envío de video a internet ni reconocimiento facial.

### 6.2 Objetivos específicos

1. **Fundamentar** el estado del arte en detección de objetos, seguimiento multiobjeto, reidentificación por apariencia y detección de EPP.
2. **Diseñar** la arquitectura cliente-servidor local, el flujo de datos y los módulos de captura, inferencia, seguimiento, interfaz y API.
3. **Implementar** la detección de personas con YOLO11n en ONNX y el seguimiento con ByteTrack, con IDs estables y conteo en tiempo real.
4. **Implementar** una memoria de apariencia que recupere el identificador de una persona reingresante dentro de una ventana temporal configurable.
5. **Construir** un dataset local de imágenes etiquetadas a partir de capturas reales, con metadatos y criterios de anotación.
6. **Entrenar y evaluar** un detector de EPP (casco y chaleco como clases mínimas) y medir precisión, recall, mAP@0.5, FPS y latencia.
7. **Definir** zonas restringidas y reglas de alerta (ingreso, permanencia y conteo máximo), con evidencia y enfriamiento de eventos.
8. **Validar** el sistema en escenarios controlados y documentar resultados, limitaciones y recomendaciones de despliegue.

### 6.3 Objetivos medibles (propuesta)

| Objetivo | Indicador | Meta propuesta |
|---|---|---|
| Detección de personas | mAP@0.5 en conjunto de prueba | `[COMPLETAR: meta, sugerido ≥ 0,80]` |
| Detección de EPP | mAP@0.5 por clase (casco, chaleco) | `[COMPLETAR: meta, sugerido ≥ 0,75]` |
| Rendimiento | FPS de inferencia en CPU | `[COMPLETAR: meta, sugerido ≥ 2 FPS]` |
| Latencia | Tiempo de inferencia por fotograma | `[COMPLETAR: sugerido ≤ 600 ms]` |
| Seguimiento | Cambios de ID en un recorrido de prueba | `[COMPLETAR: sugerido ≤ 2 por recorrido]` |
| ReID | Reentradas recuperadas correctamente | `[COMPLETAR: sugerido ≥ 80 % en condiciones controladas]` |

> Las metas deben fijarse después de la línea base experimental. No deben presentarse como resultados alcanzados.

---

## 7. Alcance y delimitaciones

### 7.1 Incluido en el proyecto

- Captura de video desde DroidCam por WiFi y proxy local MJPEG.
- Detección de personas con YOLO11n ONNX en CPU.
- Seguimiento con ByteTrack y conteo de personas con ID activo.
- Memoria de apariencia para reentradas dentro de 120 s.
- Interfaz web de monitoreo con cajas, etiquetas, métricas y eventos.
- Capturas JPEG con metadatos para dataset.
- Búsqueda de cámara en la red local y reconexión automática.
- Modo de prueba con imágenes y videos locales.
- API HTTP local documentada.
- Maqueta navegable de plataforma SaaS: portal, login, administración, empresa, planes, skills, auditoría y facturación.
- Vistas de monitoreo, cámaras y zonas integradas con el backend local.
- Skills operativas en el navegador: aforo por línea, mapa de calor, colas, puesto desatendido, control de rondas, EPP en piloto (simulación marcada), mesas y clientes, detección de caídas por heurística local y cinco skills de ocupación por áreas: barra, puestos libres, aforo de salas, aforo de aulas y aglomeraciones.
- Documentación técnica y hoja de ruta.

### 7.2 Fuera del alcance (versión actual)

- Detección real de EPP con modelo entrenado: el backend ya integra la inferencia opcional, la asociación y el resumen, y la maqueta el flujo completo, pero faltan el dataset y el modelo.
- Detección de caídas con modelo de pose: la versión actual usa solo la relación ancho/alto de la caja de persona y no reemplaza una revisión humana.
- Identificación de clientes, comensales o personal en mesas: solo se mide ocupación y permanencia por geometría.
- Distinción entre clientes y personal, medición de distancia interpersonal o atención individual en barra: las cinco skills de áreas usan solo el centro inferior de la caja de persona.
- Zonas y alertas persistentes en el backend (la maqueta las implementa en el navegador con `localStorage`).
- Identificación del guardia o validación de un recorrido completo en el control de rondas: cualquier persona que ingresa al checkpoint cuenta como visita.
- Grabación de video.
- Reconocimiento facial o identificación biométrica.
- Autenticación real y multiempresa en el backend.
- Base de datos, alta disponibilidad, despliegue en servidor público.
- Aplicación móvil nativa.
- Notificaciones por correo, SMS o mensajería.
- Sanciones automáticas o decisiones laborales basadas en el sistema.
- Entrenamiento con GPU o modelos de gran escala.

### 7.3 Delimitaciones

- El sistema se valida en un entorno controlado, con una cámara y un equipo de cómputo conocido.
- La calidad depende de la iluminación, la distancia, el ángulo y la red WiFi.
- El ReID por color de ropa no es biometría y puede fallar con uniformes idénticos.
- Los resultados de rendimiento corresponden al equipo de desarrollo (2 núcleos lógicos); no son universales.
- La maqueta SaaS es demostrativa: sus datos viven en memoria y se reinician al recargar.

---

## 8. Marco teórico y estado del arte

### 8.1 Visión artificial

La visión artificial comprende técnicas para adquirir, procesar y analizar imágenes con el fin de extraer información útil. En este proyecto se aplica a la detección y el seguimiento de personas, y a la verificación de EPP. El pipeline típico es: adquisición → preprocesamiento → detección → seguimiento → análisis → presentación.

### 8.2 Detección de objetos

La detección de objetos localiza instancias de una o varias clases mediante cajas delimitadoras y puntuaciones de confianza. Se divide en:

- **Detectores de dos etapas:** generan regiones candidatas y luego las clasifican (R-CNN, Fast R-CNN, Faster R-CNN). Mayor precisión, menor velocidad.
- **Detectores de una etapa:** predicen cajas y clases directamente (YOLO, SSD, RetinaNet). Mayor velocidad, adecuados para tiempo real.

Métricas habituales:

- **IoU** (*Intersection over Union*): solapamiento entre caja predicha y real.
- **Precisión y recall:** proporción de detecciones correctas y de objetos encontrados.
- **mAP@0.5:** media de la precisión promedio con IoU ≥ 0,5.
- **mAP@0.5:0.95:** promedio en varios umbrales de IoU; más exigente.
- **FPS y latencia:** capacidad de procesamiento en tiempo real.

### 8.3 YOLO y YOLO11n

YOLO (*You Only Look Once*) reformula la detección como una regresión única sobre la imagen. La familia ha evolucionado desde YOLOv1 (2016) hasta YOLOv8, YOLOv9, YOLOv10 y YOLO11 (Ultralytics). **YOLO11n** es la variante *nano*, pensada para dispositivos con recursos limitados. En este proyecto se usa con:

- Entrada fija de **416 × 416**.
- Clase `person` del dataset COCO (id 0).
- Confianza mínima 0.35.
- Exportación a ONNX para ejecución con ONNX Runtime en CPU.

### 8.4 Seguimiento multiobjeto

El seguimiento multiobjeto (*Multi-Object Tracking*, MOT) asigna identidades persistentes a las detecciones a lo largo del tiempo. El paradigma dominante es *tracking-by-detection*:

1. Detectar objetos en cada fotograma.
2. Predecir su posición con un filtro de Kalman.
3. Asociar detecciones y trayectorias con el algoritmo húngaro y una matriz de costo (IoU, apariencia, movimiento).

**SORT** (2016) popularizó este esquema. **DeepSORT** (2017) añadió descriptores de apariencia. **ByteTrack** (2022) asocia también detecciones de baja confianza, lo que reduce pérdidas de trayectoria. Ultralytics implementa ByteTrack y lo usa en este proyecto con un `track_buffer` de 8 fotogramas.

### 8.5 Reidentificación (ReID)

La reidentificación busca reconocer a una persona que reaparece después de haber salido del campo de visión. Los enfoques modernos usan redes neuronales que generan *embeddings* de apariencia y comparan distancias. Este proyecto usa una alternativa ligera y explicable:

- Histogramas HSV del torso y del cuerpo completo.
- Normalización L1 y vector unitario.
- Similitud por producto punto (coseno).
- Galería temporal con umbral y margen frente al segundo candidato.

No es reconocimiento facial ni identificación biométrica: solo compara color y textura de la ropa visible.

### 8.6 Detección de EPP

La detección de equipos de protección personal implica localizar y clasificar elementos como casco, chaleco, guantes, gafas y protección auditiva. Los retos son:

- Oclusiones y poses variables.
- Variedad de colores, formas y marcas.
- Condiciones de iluminación.
- Clases desbalanceadas.
- Necesidad de distinguir “persona con EPP” de “persona sin EPP”.

Los datasets públicos incluyen SHWD, CHV y Roboflow PPE. Para el proyecto se propone construir un dataset propio con capturas reales del entorno de prueba, complementado con imágenes públicas, y entrenar una variante de YOLO11n con clases mínimo viables: `helmet`, `vest`, `person`. La lógica de cumplimiento combina la detección de persona con la presencia de EPP en la región superior y media del cuerpo.

**Estado en la versión 0.4.0:** el backend ya integra la inferencia EPP opcional, la asociación persona–prenda, el suavizado temporal, las sub-cajas normalizadas y el resumen para `/api/detections`. La maqueta ya permite configurar perfiles por empresa (industrial, sitio industrial de cliente y corporativo) y muestra alertas, métricas y evidencia. **Falta el dataset y el modelo entrenado**: sin `models/epp_yolo11n.onnx` o `.pt`, el backend publica `enabled=false` y `reason="model-missing"`, y la interfaz usa una simulación marcada con badges `SIMULACIÓN`. Las métricas reales de mAP, precisión y recall quedan pendientes.

### 8.6.1 Ocupación de mesas y atención en salón

La ocupación de mesas se puede estimar sin sensores dedicados usando la detección de personas y la geometría del salón. El proyecto define cada mesa como un rectángulo relativo al cuadro y considera que una persona la ocupa cuando el centro inferior de su caja cae dentro del rectángulo. La permanencia se acumula por mesa y se compara con un objetivo de atención configurable; si se supera, se emite una alerta y se guarda evidencia. El enfoque no identifica clientes ni personal y es sensible a oclusiones y a la posición de la cámara, por lo que requiere calibración por salón.

### 8.6.2 Detección de caídas

La detección de caídas con modelos de pose ofrece mayor precisión, pero exige un modelo entrenado y más cómputo. Como primera aproximación, la versión 0.4.0 usa una heurística temporal: calcula la relación ancho/alto de la caja de persona y, si se mantiene horizontal durante varios segundos, marca una posible caída. La gracia reduce falsos positivos y el enfriamiento evita repetir el aviso. Es una ayuda operativa, no un diagnóstico: puede confundirse con personas sentadas, agachadas o cámaras muy inclinadas. La hoja de ruta prevé reemplazarla por un modelo de pose validado con videos etiquetados.

### 8.6.3 Alternativas abiertas para detección y pose

Para las skills de mesas y caídas no se necesita un modelo de *grounding* de vocabulario abierto: alcanza con detectar personas y, para caídas, estimar la pose. Se relevaron alternativas y se verificó la licencia en el repositorio oficial de cada proyecto (noviembre de 2026):

| Modelo | Tarea | Tamaño | Licencia | Hardware | Encaje |
|---|---|---|---|---|---|
| **RT-DETR** | Detección de personas en tiempo real | 20–32 M | Apache 2.0 | CPU/GPU | Runtime de mesas y caídas |
| **YOLOX** | Detección de personas | 9–54 M | Apache 2.0 | CPU/GPU | Alternativa permisiva a YOLO11n |
| **RTMPose** (MMPose) | Pose de 17 puntos | 3,6–27,7 M | Apache 2.0 | CPU/GPU | Señal de pose para caídas |
| **MediaPipe Pose** | Pose de 33 puntos | ~3 M | Apache 2.0 | CPU/GPU/móvil | Prototipo rápido de caídas |
| **Grounding DINO** | Detección abierta | ~172 M (Swin-T) | Apache 2.0 | GPU | Etiquetado offline, no tiempo real |
| **OWLv2** | Detección abierta texto-imagen | ~150 M | Apache 2.0 | GPU | Etiquetado y experimentos |
| **Florence-2** | Detección, *captioning* y *grounding* unificados | 0,23–0,77 B | MIT | GPU | Etiquetado offline |
| **Molmo 7B-D** | VLM con *pointing* | 7 B | Apache 2.0 | GPU 16 GB+ | Investigación, no runtime |
| **Qwen2.5-VL-7B** | VLM con *grounding* | 7 B | Apache 2.0 | GPU 16 GB+ | Investigación, no runtime |
| **Qwen2.5-VL-3B** | VLM con *grounding* | 3 B | Qwen Research (no comercial) | GPU 8 GB+ | Solo evaluación |
| **Rex-Omni** | Detección abierta basada en VLM | 3 B | IDEA License 1.0 (no comercial) | GPU | Solo evaluación |
| **LocateAnything-3B** | *Grounding* basado en VLM | 3 B | Pesos NVIDIA (solo investigación) | GPU NVIDIA/Linux | Solo investigación |

**Conclusión:** para producción conviene RT-DETR o YOLOX + ByteTrack + RTMPose/MediaPipe + un clasificador temporal entrenado con videos propios. Los modelos de vocabulario abierto y los VLM quedan para etiquetado y evaluación offline, porque agregan latencia y sus pesos suelen tener licencias restrictivas. Los datasets públicos de caídas también deben revisarse: la mayoría son solo para investigación.

> **Nota de licencia:** YOLO11n de Ultralytics se distribuye bajo AGPL-3.0. Para un producto cerrado se requiere licencia comercial de Ultralytics o migrar el runtime a RT-DETR/YOLOX, que son Apache 2.0.

**Skills de ocupación por áreas.** Barra, puestos libres, aforo de salas, aforo de aulas y aglomeraciones no requieren un modelo adicional: reutilizan las cajas de personas de YOLO11n/ByteTrack y aplican geometría de rectángulos en el navegador. Por eso su costo es marginal y funcionan en CPU. La limitación principal es la misma del detector de personas: oclusiones, cajas duplicadas o personas sentadas pueden alterar el conteo. Para producción conviene migrar el detector a RT-DETR o YOLOX y mantener el motor de áreas como capa de reglas independiente.

### 8.7 Procesamiento local y *edge computing*

El procesamiento en el borde reduce latencia, ancho de banda y exposición de datos. En este proyecto el “borde” es una PC de escritorio que actúa como servidor local. El video nunca sale de la red doméstica o del hotspot; el navegador consume el stream y las detecciones desde `127.0.0.1`.

### 8.8 Estado del arte y vacío identificado

Existen soluciones comerciales (Hikvision, Dahua, Avigilon) y proyectos abiertos (Frigate NVR, DeepStream, YOLO + OpenCV) para analítica de video. Sin embargo:

- Las soluciones comerciales suelen ser costosas y dependientes de la nube.
- Los proyectos abiertos requieren hardware especializado o conocimientos avanzados.
- Pocas propuestas combinan bajo costo, CPU-only, privacidad local y un flujo de dataset propio para EPP.
- En el contexto cubano, la disponibilidad de hardware y conectividad exige soluciones ligeras y reutilizables.

**Vacío:** una plataforma local, modular y documentada que integre detección de personas, seguimiento estable, ReID por apariencia, captura de dataset y una hoja de ruta clara hacia la verificación de EPP, ejecutable en equipos modestos.

### 8.9 Normas y referencias de seguridad

- **ISO 45001:2018** — Sistemas de gestión de la seguridad y salud en el trabajo.
- **OSHA 29 CFR 1910.132** — Equipos de protección personal en la industria general.
- **Ley No. 116/2014, Código de Trabajo de Cuba** — marco general de derechos y deberes laborales.
- **Normativa cubana de seguridad y salud en el trabajo** `[VERIFICAR: resolución y año aplicables]`.

> Las normas deben citarse en la versión que exija la facultad y verificarse antes de la defensa.

---

## 9. Metodología

### 9.1 Tipo de investigación

Investigación **aplicada** y **de desarrollo tecnológico**, con componente experimental. Se parte de un problema real, se construye un artefacto software y se evalúa su comportamiento en escenarios controlados.

### 9.2 Enfoque

- **Cuantitativo** para métricas de detección, seguimiento y rendimiento.
- **Cualitativo** para usabilidad, pertinencia y observaciones de campo.
- **Iterativo e incremental**: prototipo → medición → ajuste → nueva versión.

### 9.3 Fases metodológicas

| Fase | Actividades | Entregable |
|---|---|---|
| 1. Análisis | Revisión bibliográfica, requisitos, casos de uso, contexto industrial | Marco teórico y especificación de requisitos |
| 2. Diseño | Arquitectura, módulos, API, modelo de datos, interfaz | Documento de diseño y diagramas |
| 3. Implementación | Backend, detector, ReID, frontend, maqueta SaaS | Prototipo funcional |
| 4. Dataset | Captura, selección, anotación, aumento de datos | Dataset etiquetado |
| 5. Entrenamiento | Transferencia, ajuste de hiperparámetros, exportación ONNX | Modelo de EPP |
| 6. Validación | Pruebas funcionales, métricas, escenarios | Resultados experimentales |
| 7. Documentación | Tesis, manual, artículo o ponencia | Documento final |

> No se incluye cronograma por indicación del autor. Si la facultad lo exige, puede elaborarse a partir de estas fases.

### 9.4 Recolección y anotación de datos

- Capturas desde DroidCam en condiciones reales: interiores, exteriores, distintas luces, distancias y ángulos.
- Etiquetas opcionales por escenario (`entrada`, `laboratorio`, `pasillo`, etc.).
- Anotación con herramientas como LabelImg, CVAT o Roboflow.
- Clases propuestas: `person`, `helmet`, `vest`, `no_helmet`, `no_vest` (o esquema equivalente).
- División recomendada: 70 % entrenamiento, 15 % validación, 15 % prueba, estratificada por escenario.
- Control de duplicados y de imágenes sin EPP.

### 9.5 Entrenamiento y evaluación

- Transferencia desde YOLO11n preentrenado en COCO.
- Aumento de datos: brillo, contraste, rotación ligera, recorte, ruido.
- Métricas: precisión, recall, mAP@0.5, mAP@0.5:0.95, matriz de confusión.
- Evaluación de rendimiento: FPS, latencia, uso de CPU y memoria.
- Validación del seguimiento: cambios de ID, trayectorias, reentradas.
- Pruebas de usabilidad: tareas guiadas con usuarios del entorno.

### 9.6 Consideraciones éticas

- Informar a los trabajadores sobre la existencia del monitoreo.
- No usar el sistema para sanciones automáticas.
- No almacenar rostros ni plantillas biométricas.
- Limitar la retención de capturas y definir responsables.
- Garantizar que el sistema sea una ayuda, no un sustituto del criterio humano.

---

## 10. Descripción general de la solución

### 10.1 Concepto

VigIA es una plataforma de monitoreo visual que combina:

1. **Un núcleo funcional local** que captura video, detecta personas, las sigue y las reidentifica.
2. **Una capa de producto SaaS** (maqueta navegable) que organiza la operación: empresas, planes, usuarios, skills, auditoría, facturación y monitoreo.
3. **Una hoja de ruta** hacia la detección de EPP, zonas y alertas.

### 10.2 Actores

| Actor | Descripción |
|---|---|
| **Creador / administrador de plataforma** | Gestiona empresas, planes, skills, solicitudes, sesiones y auditoría. |
| **Administrador de empresa** | Gestiona usuarios, skills, plan y configuración de su empresa. |
| **Supervisor** | Accede al resumen, al monitoreo y a usuarios. |
| **Operador** | Accede al resumen y al monitoreo. |
| **Trabajador** | Persona monitoreada; no interactúa con el sistema. |
| **Responsable de seguridad** | Usa los eventos y métricas para la mejora continua. |

### 10.3 Módulos funcionales

```text
┌─────────────────────────────────────────────────────────────┐
│                        VigIA                          │
├──────────────────────┬──────────────────────────────────────┤
│  Núcleo local        │  Plataforma SaaS (maqueta)           │
│  ─ Captura DroidCam  │  ─ Portal público                    │
│  ─ Detección YOLO    │  ─ Login / solicitud de acceso       │
│  ─ ByteTrack         │  ─ Consola de administrador          │
│  ─ ReID apariencia   │  ─ Consola de empresa                │
│  ─ API local         │  ─ Planes, skills, auditoría         │
│  ─ Capturas/dataset  │  ─ Monitoreo, cámaras, zonas         │
│  ─ Interfaz web      │  ─ Facturación y sesiones            │
└──────────────────────┴──────────────────────────────────────┘
```

### 10.4 Propuesta de valor

- **Privacidad:** el video no sale del equipo.
- **Bajo costo:** hardware reutilizable y software libre.
- **Claridad:** IDs estables y métricas en tiempo real.
- **Escalabilidad:** la maqueta y la API anticipan multiempresa y nuevos módulos.
- **Trazabilidad:** capturas con metadatos y eventos de sesión.

### 10.5 Estado actual frente a la meta

| Capacidad | Estado actual (0.4.0) | Meta de la tesis |
|---|---|---|
| Captura y visualización | Implementado | Mantener |
| Detección de personas | Implementado | Validar con métricas |
| Seguimiento | Implementado | Validar cambios de ID |
| ReID por apariencia | Implementado | Validar reentradas |
| Capturas/dataset | Implementado | Construir dataset EPP |
| Detección de EPP | Integración backend + piloto UI; sin modelo entrenado | Entrenar, evaluar e instalar el modelo |
| Zonas y alertas | Solo maqueta (navegador) | Implementar en backend |
| Métricas y reportes | Parcial (sesión) | Consolidar |
| Autenticación/multiempresa | Solo maqueta | Fuera de alcance o fase futura |

---

## 11. Recursos necesarios

### 11.1 Hardware

| Recurso | Uso | Estado |
|---|---|---|
| PC con Windows 10/11 | Servidor y procesamiento | Disponible (2 núcleos lógicos) |
| Teléfono con DroidCam | Cámara IP por WiFi | Disponible |
| Red WiFi u hotspot | Comunicación PC–teléfono | Disponible |
| Cámara IP o USB (opcional) | Escenarios adicionales | `[COMPLETAR]` |
| Trípode o soporte | Estabilidad de la cámara | `[COMPLETAR]` |

### 11.2 Software

| Software | Versión / nota |
|---|---|
| Python | 3.10 o superior; probado con 3.14 |
| Ultralytics | Detección y ByteTrack |
| ONNX Runtime | Inferencia CPU |
| OpenCV | Procesamiento de imagen |
| PyTorch CPU | Dependencia de Ultralytics |
| `lap` | Asignación para ByteTrack |
| Navegador moderno | Chrome, Edge o Firefox |
| DroidCam | Cliente móvil |

### 11.3 Recursos humanos

- Autor del proyecto.
- Tutor `[COMPLETAR]`.
- Personal de la empresa o institución para facilitar escenarios y validación.
- Usuarios para pruebas de usabilidad.

### 11.4 Costos estimados

| Concepto | Costo estimado |
|---|---|
| PC existente | USD 0 (reutilizada) |
| Teléfono existente | USD 0 (reutilizado) |
| Software | USD 0 (open source) |
| Cámara IP opcional | `[COMPLETAR]` |
| Soporte/trípode | `[COMPLETAR]` |
| Impresión y encuadernación | `[COMPLETAR]` |
| **Total** | `[COMPLETAR]` |

> El proyecto está diseñado para minimizar costos. Cualquier compra debe justificarse en la tesis.

---

## 12. Resultados esperados

1. **Prototipo funcional** de monitoreo local con detección, seguimiento y ReID.
2. **Módulo de detección de EPP** entrenado y evaluado con métricas reproducibles.
3. **Sistema de zonas y alertas** con evidencia y enfriamiento de eventos.
4. **Dataset etiquetado** de imágenes del entorno, con metadatos y documentación.
5. **Documentación técnica** reproducible: instalación, operación, API y parámetros.
6. **Tesis** que justifique, describa y valide la solución.
7. **Posible artículo o ponencia** en evento científico estudiantil.
8. **Base para futuras versiones**: multiempresa, notificaciones, reportes y endurecimiento.

---

## 13. Referencias preliminares

> Referencias de partida. Deben completarse según las normas de la facultad (APA, IEEE u otra) y verificarse antes de la defensa.

1. Redmon, J., Divvala, S., Girshick, R., & Farhadi, A. (2016). *You Only Look Once: Unified, Real-Time Object Detection*. CVPR.
2. Jocher, G., et al. (2024). *Ultralytics YOLO11*. GitHub. https://github.com/ultralytics/ultralytics
3. Zhang, Y., et al. (2022). *ByteTrack: Multi-Object Tracking by Associating Every Detection Box*. ECCV.
4. Bewley, A., et al. (2016). *Simple Online and Realtime Tracking*. IEEE ICIP.
5. Wojke, N., Bewley, A., & Paulus, D. (2017). *Simple Online and Realtime Tracking with a Deep Association Metric*. IEEE ICIP.
6. Lin, T.-Y., et al. (2014). *Microsoft COCO: Common Objects in Context*. ECCV.
7. Everingham, M., et al. (2010). *The PASCAL Visual Object Classes Challenge*. IJCV.
8. Bochkovskiy, A., Wang, C.-Y., & Liao, H.-Y. M. (2020). *YOLOv4: Optimal Speed and Accuracy of Object Detection*. arXiv.
9. Wang, C.-Y., Bochkovskiy, A., & Liao, H.-Y. M. (2023). *YOLOv7: Trainable Bag-of-Freebies Sets New State-of-the-Art for Real-Time Object Detectors*. CVPR.
10. ISO. (2018). *ISO 45001:2018 — Occupational health and safety management systems*.
11. OSHA. (s. f.). *29 CFR 1910.132 — Personal Protective Equipment*.
12. Cuba. (2014). *Ley No. 116/2014, Código de Trabajo*.
13. OpenCV. (s. f.). *OpenCV Documentation*. https://docs.opencv.org/
14. ONNX Runtime. (s. f.). *ONNX Runtime Documentation*. https://onnxruntime.ai/
15. Ultralytics. (s. f.). *YOLO11 Documentation*. https://docs.ultralytics.com/
16. Frigate NVR. (s. f.). *Frigate — NVR with real-time AI object detection*. https://frigate.video/
17. DroidCam. (s. f.). *DroidCam — Use your phone as a webcam*. https://www.dev47apps.com/

# PARTE II — DOSSIER TÉCNICO COMPLETO

## 14. Ficha técnica del repositorio

### 14.1 Versiones y estado

| Elemento | Valor observado |
|---|---|
| `server.py` → `VERSION` | `0.4.0` |
| `README.md` → versión declarada | `0.4.0` |
| `mockup/index.html` → splash | `v0.4.0 · LOCAL` |
| Login de la maqueta | `MAQUETA V0.1 · SIN BACKEND` |
| Estado del repositorio | Sin `.git` inicializado; existe `.gitignore` |
| Pruebas automatizadas | `tests/test_epp.py` (27), `tests/test_falls.py` (10) y `tests/test_areas.py` (integración con 9 pruebas Node) con `unittest`: asociación, suavizado, normalización, resumen, heurística de caídas y motor de áreas |
| Licencia | No hay archivo `LICENSE` |
| Última modificación de archivos | 17 de noviembre de 2026 |

> **Observación para la tesis:** la versión del README y la del servidor ya coinciden en 0.4.0. Conviene mantener un changelog para las próximas skills.

### 14.2 Estructura de archivos

```text
VigIA/
├── .gitignore
├── README.md                     Documentación funcional y de operación (v0.4.0)
├── DOCUMENTACION.md              Este documento
├── run.bat                       Lanzador de Windows
├── server.py                     Servidor HTTP, proxy de cámara, API y capturas
├── detector.py                   Hilo de inferencia, ByteTrack y ReID
├── .venv/                        Entorno virtual de Python
├── models/
│   ├── yolo11n.onnx              Modelo principal (10,6 MB)
│   ├── yolo11n.pt                Respaldo PyTorch (5,6 MB)
│   └── epp/
│       └── README.md             Guía del modelo EPP (sin modelo entrenado)
├── tests/
│   ├── __init__.py
│   ├── test_epp.py               Pruebas unitarias del detector EPP
│   ├── test_falls.py             Pruebas unitarias de la heurística de caídas
│   ├── test_areas.py             Integración unittest con la suite Node de áreas
│   └── areas.test.js             Pruebas del motor de barra, puestos, salas, aulas y aglomeraciones
├── static/
│   └── index.html                Interfaz clásica (126 KB), servida en /clasico
├── mockup/
│   ├── index.html                Entrada de la maqueta SPA
│   ├── assets/
│   │   └── camera-frame.jpg      Imagen de demostración
│   ├── css/
│   │   └── autec.css             Sistema de diseño (94 KB)
│   └── js/
│       ├── icons.js              Iconos SVG
│       ├── utils.js              Utilidades
│       ├── data.js               Datos semilla de la plataforma
│       ├── components.js         Componentes de UI
│       ├── zones.js              Zonas, colas, puesto desatendido y rondas
│       ├── lines.js              Aforo por línea
│       ├── heatmap.js            Mapa de calor
│       ├── epp.js                Reglas EPP por empresa y simulación marcada
│       ├── tables.js             Mesas, ocupación y atención en salón
│       ├── falls.js              Heurística local de caídas por empresa
│       ├── areas.js              Motor de barra, puestos, salas, aulas y aglomeraciones
│       ├── monitor.js            Integración con el backend y monitoreo
│       ├── cameras.js            Perfiles de cámara
│       ├── views-public.js       Landing, login y solicitud
│       ├── views-admin.js        Consola del creador
│       ├── views-company.js      Consola de empresa
│       ├── app.js                Router, estado y eventos
│       └── splash.js             Animación de arranque
├── data/
│   └── captures/                 Dataset: JPEG + JSON
└── __pycache__/                  Caché de Python
```

### 14.3 Dependencias principales

| Dependencia | Función | Nota |
|---|---|---|
| `ultralytics` | YOLO11n, ByteTrack | Incluye PyTorch |
| `onnxruntime` | Inferencia ONNX en CPU | Modelo principal |
| `opencv-python` | Decodificación, histogramas, dibujo | Usado en detector y ReID |
| `torch` / `torchvision` | Backend de Ultralytics | Versión CPU |
| `lap` | Asignación húngara para ByteTrack | Sin `lap`, no hay tracking |
| `numpy` | Álgebra y buffers | Dependencia transitiva |

Instalación documentada:

```powershell
python -m venv .venv --system-site-packages
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install ultralytics onnxruntime opencv-python lap
.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 14.4 Modelos

| Archivo | Tamaño | Uso |
|---|---|---|
| `models/yolo11n.onnx` | 10 604 698 bytes | Modelo principal; entrada fija 416 × 416 |
| `models/yolo11n.pt` | 5 613 764 bytes | Respaldo si falta el ONNX |
| `models/epp_yolo11n.onnx` | No existe | Opcional: casco y chaleco |
| `models/epp_yolo11n.pt` | No existe | Respaldo EPP si falta el ONNX |

Selección en `detector.py`:

```python
model_path = ONNX_PATH if ONNX_PATH.exists() else MODEL_PATH
```

Si no existe ninguno, el detector pasa a estado `error` y el video sigue funcionando. El modelo EPP es independiente y opcional: si falta, el detector de personas sigue activo y `/api/detections` informa `epp.available=false` con `reason="model-missing"`.

### 14.5 Puertos y directorios

| Elemento | Valor |
|---|---|
| Servidor local | `127.0.0.1:8000` (`AUTEC_PORT`) |
| Servidor alternativo | `python server.py 8080` |
| Cámara DroidCam | Puerto `4747` por defecto |
| Maqueta en servidor estático | Puerto `8081` (se conecta al backend en `8000`) |
| Capturas | `data/captures` |
| Modelos | `models/` |
| Interfaz clásica | `static/index.html` → `/clasico` |
| Interfaz principal | `mockup/index.html` → `/` |

---

## 15. Arquitectura del sistema

### 15.1 Diagrama general

```text
┌─────────────────────┐
│  Teléfono           │
│  DroidCam           │
│  (stream MJPEG)     │
└─────────┬───────────┘
          │ HTTP :4747
          ▼
┌─────────────────────────────────────────────────────────────┐
│  PC local — server.py                                       │
│                                                             │
│  1. Abre UNA conexión con DroidCam                          │
│  2. Reenvía el stream original al navegador                 │
│  3. Extrae copias de cada JPEG                              │
│  4. Las ofrece al detector (cola de capacidad 1)            │
│  5. Sirve la web, la API y las capturas                     │
└─────────┬───────────────────────────────┬───────────────────┘
          │ MJPEG                         │ JSON / JPEG
          ▼                               ▼
┌─────────────────────┐         ┌─────────────────────────────┐
│  Navegador          │         │  detector.py (hilo aparte)  │
│  - video original   │         │  YOLO11n ONNX               │
│  - canvas de cajas  │◄────────┤  ByteTrack                  │
│  - panel y métricas │  poll   │  Memoria de apariencia      │
└─────────────────────┘  400 ms └─────────────────────────────┘
```

### 15.2 Flujo de datos

1. El usuario configura IP, puerto y resolución en la interfaz.
2. `server.py` valida los datos y prueba las rutas de DroidCam.
3. Al abrir `/stream`, el servidor se convierte en el **único cliente** de la cámara.
4. Cada `chunk` recibido se reenvía al navegador sin modificar.
5. En paralelo, `extract_jpeg_frames()` separa los JPEG completos del buffer.
6. Cada JPEG se ofrece a `detector.offer_frame()`; si la cola está llena, se descarta el anterior.
7. El hilo del detector decodifica, infiere, actualiza ByteTrack y ReID.
8. El estado se publica en memoria compartida con lock.
9. El navegador consulta `/api/detections` cada 400 ms y dibuja las cajas en un canvas.
10. Las capturas se guardan en disco con metadatos.

### 15.3 Componentes

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Servidor HTTP | `server.py` | Rutas, proxy, API, estáticos, capturas |
| Detector | `detector.py` | Inferencia, tracking, ReID, estado |
| Interfaz clásica | `static/index.html` | Visor funcional previo |
| Maqueta SaaS | `mockup/` | Producto, consolas, monitoreo |
| Modelos | `models/` | Pesos ONNX y PyTorch |
| Dataset | `data/captures/` | Evidencia y entrenamiento |

### 15.4 Concurrencia y estados

- `ThreadingHTTPServer`: cada petición se atiende en un hilo.
- Un único hilo `autec-detector` procesa la inferencia.
- Cola `queue.Queue(maxsize=1)`: prima el fotograma más reciente; no se acumula retraso.
- `threading.Lock` protege el estado compartido (`_STATE`).
- `STREAM_LOCK` protege el estado del stream.
- `CAPTURE_LOCK` evita colisiones de nombres.
- `DISCOVER_LOCK` impide búsquedas simultáneas.
- Contador de generación (`_GENERATION`): invalida resultados calculados antes de una desconexión.

Estados del detector:

| Estado | Significado |
|---|---|
| `idle` | Sin video o detector detenido |
| `loading` | Cargando el modelo o la primera inferencia |
| `running` | Procesando fotogramas |
| `disabled` | `AUTEC_DETECT=0` |
| `error` | Fallo de modelo, dependencias o inferencia |
| `stopped` | Detención explícita |

### 15.5 Manejo de errores

- Si faltan dependencias de IA, el detector falla pero el video sigue.
- Si falta `lap`, ByteTrack no se inicializa y se usa conteo por fotograma.
- Si faltan ambos modelos, se reporta `error`.
- Cinco errores consecutivos de inferencia detienen el detector.
- Las desconexiones del navegador no se registran como errores.
- Si el stream se corta, el frontend reconecta hasta 8 veces (maqueta) o 12 (interfaz clásica, según README).

### 15.6 Seguridad de la arquitectura

- El servidor escucha solo en `127.0.0.1`: no es accesible desde la red local ni internet.
- No hay autenticación real; es un prototipo local.
- CORS abierto (`*`) para facilitar el desarrollo de la maqueta en otro puerto.
- No se envían imágenes a servicios externos.
- Las capturas quedan en disco local; su protección depende del sistema operativo.

---

## 16. Backend `server.py`

### 16.1 Responsabilidades

- Servir la interfaz principal y la clásica.
- Servir archivos estáticos de `mockup/`.
- Validar IP, puerto y resolución.
- Descubrir la cámara en la red local.
- Abrir y proxyar el stream MJPEG.
- Extraer JPEG y alimentar al detector.
- Exponer la API de estado, capturas y descubrimiento.
- Guardar capturas con metadatos.
- Permitir descargar un snapshot.
- Mantener el estado del stream.

### 16.2 Constantes principales

| Constante | Valor | Función |
|---|---|---|
| `APP_NAME` | `VigIA` | Nombre del servicio |
| `VERSION` | `0.4.0` | Versión |
| `DEFAULT_PORT` | `8000` | Puerto del servidor |
| `DEFAULT_CAMERA_PORT` | `4747` | Puerto de DroidCam |
| `DEFAULT_RESOLUTION` | `1280x720` | Resolución por defecto |
| `RESOLUTION_RE` | `^\d{2,4}x\d{2,4}$` | Validación |
| `MAX_CAPTURE_BYTES` | 12 MB | Límite de captura |
| `MAX_SNAPSHOT_BYTES` | 8 MB | Límite de snapshot |
| `MAX_STREAM_BUFFER` | 12 MB | Límite del buffer MJPEG |
| `HOST_RE` | `^[A-Za-z0-9.\-]+$` | Validación de host |
| `USER_AGENT` | `VigIA/0.4.0` | Identificación |

### 16.3 Validación del objetivo

`parse_target(host_raw, port_raw)`:

- Acepta IP, nombre de host o URL.
- Acepta `host:puerto` en un solo campo.
- Elimina rutas y parámetros.
- Valida el host con expresión regular.
- Valida el puerto entre 1 y 65535.
- Lanza `ValueError` con mensajes claros.

`normalize_resolution(value)`:

- Acepta `1280x720`, `1280×720`, con o sin espacios.
- Rango válido: ancho 160–4096, alto 120–2160.
- Si no es válido, devuelve `1280x720`.

### 16.4 Conexión con DroidCam

Rutas preferidas según resolución:

```text
/video/force/{res}
/video/{res}
/mjpegfeed?{res}
```

Rutas fijas de respaldo:

```text
/video/force/1280x720
/video/force/640x480
/video/1280x720
/video/640x480
/video
/mjpegfeed?1280x720
/mjpegfeed?640x480
/mjpegfeed
```

`open_camera_stream()`:

- Prueba cada ruta con `urllib`.
- Acepta `multipart/x-mixed-replace` o `image/jpeg`.
- Detecta la página HTML de “DroidCam is Busy”.
- Devuelve la respuesta abierta, la URL y el tipo de contenido.
- Si ninguna ruta funciona, lanza `CameraError` con detalle.

Errores típicos:

| Situación | Mensaje |
|---|---|
| No hay conexión | “No se pudo conectar con IP:puerto…” |
| Cámara ocupada | “DroidCam está ocupado por otra conexión…” |
| Responde HTML | “DroidCam respondió con una página web, no con un stream…” |
| Sin stream compatible | “DroidCam respondió, pero no se encontró un stream compatible…” |

### 16.5 Proxy MJPEG

`handle_stream()`:

1. Valida host, puerto y resolución.
2. Abre la cámara.
3. Detecta si cambió la fuente y reinicia el detector.
4. Envía cabeceras `multipart/x-mixed-replace`, sin caché.
5. Lee bloques de 16 KB.
6. Reenvía cada bloque al navegador y hace `flush`.
7. Extrae JPEG completos y los ofrece al detector.
8. Actualiza contadores (`chunks`, `frames`, `lastChunkAt`).
9. Al cerrar, decrementa clientes activos; si llega a cero, reinicia el detector.

### 16.6 Extracción de JPEG

`extract_jpeg_frames(buffer)`:

- Busca el marcador de inicio `FF D8`.
- Busca el marcador de fin `FF D9`.
- Extrae el JPEG completo.
- Conserva el buffer entre lecturas para fotogramas partidos.
- Si el buffer crece demasiado sin cierre, descarta el inicio corrupto.
- Nunca modifica los bytes que recibe el navegador.

### 16.7 Descubrimiento de cámara

`handle_discover()`:

- Toma la IP local de la interfaz por defecto.
- Verifica que sea una red privada.
- Calcula la subred `/24`.
- Prueba el puerto 4747 en todos los hosts con 64 hilos y timeout de 0.25 s.
- Para cada host con el puerto abierto, descarga `/` y busca la cadena `droidcam`.
- Devuelve candidatos ordenados por verificación y por IP.
- Solo permite una búsqueda simultánea (`429` si hay otra en curso).

Respuesta:

```json
{
  "ok": true,
  "localIp": "192.168.1.10",
  "subnet": "192.168.1.0/24",
  "candidates": [
    { "ip": "192.168.1.24", "port": 4747, "verified": true }
  ]
}
```

### 16.8 Capturas y dataset

`handle_capture()`:

- Recibe un JPEG por `POST`.
- Valida tamaño (≤ 12 MB) y marcadores JPEG.
- Sanea la etiqueta (`label`).
- Genera nombre `YYYYMMDD_HHMMSS_mmm_label.jpg`.
- Evita colisiones con contador.
- Guarda el JPEG y un JSON con metadatos.
- Devuelve nombre, ruta, total y etiqueta.

Metadatos:

```json
{
  "filename": "20261111_143208_123_entrada.jpg",
  "capturedAt": "2026-11-11T14:32:08-05:00",
  "label": "entrada",
  "mode": "camera",
  "host": "172.20.10.2",
  "port": "4747",
  "resolution": "1280x720",
  "bytes": 84213,
  "appVersion": "0.4.0"
}
```

### 16.9 Servidor estático y SPA

- `/` y `/index.html` → `mockup/index.html`.
- `/clasico`, `/legacy` → `static/index.html`.
- Archivos de `mockup/` se sirven con tipos MIME y `Cache-Control: no-store`.
- Rutas `/app`, `/admin`, `/login`, `/solicitar-acceso` devuelven `index.html` para que el router del navegador resuelva.
- Se impide el acceso fuera de `mockup/` con `resolve()` y `relative_to()`.

### 16.10 Arranque

`main()`:

- Puerto por argumento o `AUTEC_PORT`.
- Verifica que exista `mockup/index.html`.
- Advierte si falta `static/index.html`.
- Crea `data/captures`.
- Abre `127.0.0.1:puerto`.
- Imprime banner con rutas de cámara.
- Ejecuta `serve_forever()`.
- Al salir, detiene el detector y cierra el servidor.

---

## 17. Detector `detector.py`

### 17.1 Diseño

- Importa las librerías pesadas **dentro del hilo** de inferencia.
- Así el servidor arranca aunque el entorno de IA no esté instalado.
- El detector no abre conexiones a la cámara: recibe JPEG del servidor.
- Mantiene un único hilo de trabajo y una cola de capacidad 1.
- Publica el estado en un diccionario protegido por lock.

### 17.2 Constantes

| Constante | Valor | Significado |
|---|---|---|
| `ENABLED` | `True` (`AUTEC_DETECT`) | Activa/desactiva la IA |
| `PERSON_CLASS_ID` | `0` | Clase `person` de COCO |
| `CONFIDENCE` | `0.35` | Confianza mínima |
| `IMAGE_SIZE` | `416` | Entrada del modelo |
| `TARGET_INTERVAL` | `0.2` s | Objetivo ~5 inferencias/s |
| `MAX_FRAME_BYTES` | 4 MB | Límite por fotograma |
| `STALE_SECONDS` | `3.0` s | Antigüedad para marcar sin datos |
| `TRACK_TTL` | `1.5` s | Tolerancia de conteo por ID |
| `TRACK_BUFFER` | `8` fotogramas | Memoria de ByteTrack |
| `REID_ENABLED` | `True` (`AUTEC_REID`) | Activa/desactiva ReID |
| `REID_MEMORY_SECONDS` | `120` s | Ventana de memoria |
| `REID_THRESHOLD` | `0.66` | Similitud mínima |
| `REID_MARGIN` | `0.05` | Margen frente al segundo |
| `REID_GRACE_SECONDS` | `0.75` s | Espera antes de guardar |
| `REID_MAX_DESCRIPTORS` | `6` | Muestras por persona |
| `REID_MAX_GALLERY` | `40` | Personas recordadas |

### 17.3 Pipeline

```text
JPEG
  │
  ▼
cv2.imdecode → frame BGR
  │
  ▼
model.predict(imgsz=416, conf=0.35, classes=[0])
  │
  ▼
boxes (xyxy, conf, cls)
  │
  ▼
ByteTrack.update(boxes, frame)
  │
  ▼
tracks (x1, y1, x2, y2, track_id, conf)
  │
  ▼
ReID: display_id_for(track_id, frame, box)
  │
  ▼
conteo, FPS, estado
  │
  ▼
publicación thread-safe
```

### 17.4 ByteTrack

- Se carga desde `bytetrack.yaml` de Ultralytics.
- Se ajusta `track_buffer = 8`.
- A ~2–4 FPS reales, 8 fotogramas equivalen a 2–4 segundos.
- Requiere `lap`; si falta, el detector funciona sin IDs estables.
- Se reinicia al cambiar de fuente o de generación.

### 17.5 Conteo

- `visiblePersons`: cajas del último fotograma.
- `trackedPersons`: IDs vistos dentro de `TRACK_TTL` (1.5 s).
- `persons`: valor mostrado en el HUD; usa IDs activos si hay tracker.
- `uniquePersons`: IDs distintos vistos en la sesión.
- `reidMatches`: recuperaciones exitosas de ReID.
- El conteo no parpadea ante una detección aislada fallida.

### 17.6 FPS y latencia

- `inferenceMs`: tiempo de `predict` + `tracker.update`.
- `fps`: media exponencial (80 % anterior, 20 % instantánea).
- El bucle espera hasta completar `TARGET_INTERVAL` (0.2 s) sin acumular retraso.
- En la práctica, el equipo de desarrollo obtiene ~2 FPS.

### 17.7 Antigüedad y estado

- Si `status == running` y `ageSeconds > 3`, se limpian conteos y cajas.
- `ageSeconds` se calcula desde `updatedAt`.
- El frontend muestra “sin fotogramas recientes” cuando corresponde.

### 17.8 Errores

- Error de importación → estado `error`, mensaje en consola.
- Modelo ausente → estado `error`.
- Error de inferencia → se incrementa contador; a los 5 consecutivos se detiene.
- `ByteTrack` no disponible → se usa conteo por fotograma.
- `ReID` no disponible → se usan IDs directos.

### 17.9 Generaciones

- `_GENERATION` aumenta al desconectar.
- Un resultado calculado con una generación anterior no se publica.
- Evita que una caja vieja reaparezca después de desconectar.
- Al cambiar de generación se reinician tracker, memoria, IDs y conteos.

### 17.10 Control de hilos

- `AUTEC_THREADS` (1–4, por defecto 2).
- Se fija `intra_op_num_threads` en ONNX Runtime.
- Se fija `torch.set_num_threads`.
- Se define `OMP_NUM_THREADS`.
- `YOLO_OFFLINE=1` y `YOLO_AUTOINSTALL=false` evitan comprobaciones de red.

### 17.11 Funciones principales

| Función | Responsabilidad |
|---|---|
| `offer_frame(jpeg)` | Encolar el último fotograma |
| `snapshot()` | Devolver estado serializable |
| `reset()` | Limpiar estado y cambiar generación |
| `stop()` | Detener el hilo |
| `_worker()` | Bucle de inferencia |
| `_AppearanceMemory` | ReID por histogramas |

---

## 18. ReID por apariencia

### 18.1 Motivación

ByteTrack mantiene un ID mientras el rastro está activo. Si la persona sale del plano, el rastro se pierde y al volver recibe un ID nuevo. La memoria de apariencia intenta devolverle el número anterior durante 120 s.

### 18.2 Descriptor

Para cada caja:

1. Se recorta la persona con un pequeño margen (5 % horizontal, 3 % vertical).
2. Se redimensiona a 64 × 128.
3. Se convierte a HSV.
4. Se calcula un histograma 2D de canales H y S con 8 × 8 bins.
5. Se normaliza con L1 y se aplana.
6. Se calcula:
   - **Torso:** franja entre 8 % y 62 % de la altura, 10–90 % del ancho.
   - **Cuerpo:** imagen completa dividida en una cuadrícula 2 × 2.
7. Se concatenan con pesos:
   - Torso: `sqrt(0.75)`.
   - Cuerpo: `sqrt(0.25)`.
8. Se normaliza el vector a norma unitaria.

El torso pesa más porque describe la ropa; el cuerpo ayuda cuando el torso está parcialmente tapado.

### 18.3 Coincidencia

- Se compara el descriptor nuevo con los descriptores guardados.
- Se usa producto punto (coseno) y se toma el máximo por persona.
- Candidatos:
  - Personas en la galería (ausentes).
  - Personas en `active` cuyo ID de ByteTrack ya no aparece en el fotograma.
- Se ordenan por similitud.
- Se acepta si:
  - `best_score >= REID_THRESHOLD` (0.66).
  - `best_score - second_score >= REID_MARGIN` (0.05).
- Si hay ambigüedad, se prefiere un ID nuevo antes que confundir.

### 18.4 Ciclo de vida

```text
Persona detectada
  │
  ├── ¿ID de ByteTrack ya conocido? → mantener display_id
  │
  └── ¿ID nuevo? → buscar en galería/activos ausentes
          │
          ├── coincidencia segura → recuperar display_id
          └── sin coincidencia → nuevo display_id
  │
  ▼
Al dejar de verse 0.75 s → se guarda en galería
  │
  ▼
Después de 120 s → se elimina de la galería
  │
  ▼
Máximo 40 personas recordadas
```

### 18.5 Parámetros

| Parámetro | Valor | Efecto |
|---|---|---|
| `REID_MEMORY_SECONDS` | 120 s | Tiempo que se recuerda a una persona |
| `REID_THRESHOLD` | 0.66 | Similitud mínima |
| `REID_MARGIN` | 0.05 | Separación mínima del segundo |
| `REID_GRACE_SECONDS` | 0.75 s | Espera antes de guardar |
| `REID_MAX_DESCRIPTORS` | 6 | Muestras por persona |
| `REID_MAX_GALLERY` | 40 | Personas en memoria |

### 18.6 Limitaciones

- No es reconocimiento facial ni biometría.
- Falla con uniformes idénticos.
- Falla con cambios bruscos de iluminación.
- Falla si la persona se gira o cambia de ropa.
- Falla si pasan más de 120 s.
- No usa posición; una reentrada por otra zona puede no coincidir.
- No distingue personas con ropa muy similar; prefiere ID nuevo.

### 18.7 Diferencia con ReID profundo

El ReID profundo usa redes convolucionales o transformers para generar embeddings entrenados con pérdidas de identidad y triplete. Este proyecto usa histogramas de color: es más rápido, explicable y no requiere entrenamiento, pero menos robusto. Para la tesis, conviene describirlo como **reidentificación heurística por apariencia**, no como ReID biométrico.

---

## 19. API local

### 19.1 Endpoints

| Método | Ruta | Parámetros | Respuesta |
|---|---|---|---|
| GET | `/api/health` | — | Estado, versión, rutas, directorio |
| GET | `/api/probe` | `host`, `port`, `res` | Verifica la cámara |
| GET | `/api/stream-health` | — | Clientes, chunks, frames, antigüedad |
| GET | `/api/detections` | — | Estado completo del detector |
| GET | `/api/captures` | — | Total y últimas capturas |
| POST | `/api/capture` | `label`, `mode`, `host`, `port`, `resolution`, `zone`, `event`, `profile`, `trackId`, `missing`, `table`, `fallSeconds`, `simulated` | Guarda JPEG + JSON |
| GET | `/api/discover` | `port` | Busca cámaras en la LAN |
| GET | `/stream` | `host`, `port`, `res` | Proxy MJPEG |
| GET | `/snapshot` | `host`, `port`, `res` | JPEG descargable |
| GET | `/` | — | Maqueta principal |
| GET | `/clasico` | — | Interfaz clásica |

### 19.2 Ejemplos

**`GET /api/health`**

```json
{
  "ok": true,
  "service": "VigIA",
  "version": "0.4.0",
  "cameraPaths": ["/video/force/1280x720", "..."],
  "defaultResolution": "1280x720",
  "capturesDir": "D:\\Autec\\Proyectos\\VigIA\\data\\captures"
}
```

**`GET /api/detections`**

```json
{
  "ok": true,
  "active": true,
  "status": "running",
  "persons": 3,
  "visiblePersons": 3,
  "trackedPersons": 3,
  "uniquePersons": 3,
  "reidMatches": 1,
  "detections": [
    {
      "x1": 161.6,
      "y1": 173.6,
      "x2": 245.4,
      "y2": 403.6,
      "confidence": 0.83,
      "trackId": 1,
      "epp": {
        "helmet": true,
        "vest": false,
        "missing": ["vest"],
        "status": "missing",
        "simulation": false
      },
      "fall": {
        "status": "normal",
        "suspect": false,
        "fallen": false,
        "ratio": 0.52,
        "seconds": 0.0,
        "threshold": 1.05
      }
    }
  ],
  "epp": {
    "enabled": true,
    "available": true,
    "model": "epp_yolo11n.onnx",
    "reason": "",
    "persons": 3,
    "compliant": 2,
    "nonCompliant": 1,
    "unknown": 0,
    "withHelmet": 3,
    "withVest": 2,
    "withoutHelmet": 0,
    "withoutVest": 1,
    "compliance": 66.7
  },
  "falls": {
    "enabled": true,
    "available": true,
    "heuristic": true,
    "model": "box-ratio",
    "reason": "",
    "persons": 3,
    "suspects": 0,
    "fallen": 0,
    "ratioThreshold": 1.05,
    "graceSeconds": 3.0,
    "cooldownSeconds": 120.0
  },
  "width": 640,
  "height": 480,
  "inferenceMs": 500.0,
  "fps": 2.0,
  "updatedAt": 1760000000.0,
  "ageSeconds": 0.2,
  "error": "",
  "model": "YOLO11n ONNX · COCO + ByteTrack + ReID"
}
```

**`GET /api/stream-health`**

```json
{
  "ok": true,
  "active": 1,
  "ageSeconds": 0.1,
  "chunks": 1520,
  "frames": 310,
  "url": "http://172.20.10.2:4747/video/force/1280x720"
}
```

**`GET /api/captures`**

```json
{
  "ok": true,
  "dir": "D:\\Autec\\Proyectos\\VigIA\\data\\captures",
  "count": 42,
  "recent": ["20261111_143208_123_entrada.jpg"]
}
```

**`GET /api/discover`**

```json
{
  "ok": true,
  "localIp": "192.168.1.10",
  "subnet": "192.168.1.0/24",
  "candidates": [
    { "ip": "192.168.1.24", "port": 4747, "verified": true }
  ]
}
```

**`POST /api/capture`**

```text
POST /api/capture?label=entrada&mode=camera&host=172.20.10.2&port=4747&resolution=1280x720
Content-Type: image/jpeg

<bytes JPEG>
```

Respuesta:

```json
{
  "ok": true,
  "filename": "20261111_143208_123_entrada.jpg",
  "path": "D:\\Autec\\Proyectos\\VigIA\\data\\captures\\20261111_143208_123_entrada.jpg",
  "count": 43,
  "label": "entrada"
}
```

### 19.3 Códigos de error

| Código | Uso |
|---|---|
| 400 | Parámetros inválidos, captura vacía o no JPEG |
| 404 | Ruta no encontrada |
| 413 | Captura mayor a 12 MB |
| 429 | Búsqueda de cámara en curso |
| 500 | Error inesperado o de disco |
| 502 | Error de cámara (`CameraError`) |

### 19.4 CORS y caché

- `Access-Control-Allow-Origin: *`.
- Métodos permitidos: `GET, POST, OPTIONS`.
- `Cache-Control: no-store` en API y estáticos.
- El stream usa `no-cache` y `Connection: close`.

---

## 20. Variables de entorno

| Variable | Valores | Efecto |
|---|---|---|
| `AUTEC_DETECT` | `0` / `1` | Desactiva o activa la IA |
| `AUTEC_REID` | `0` / `1` | Desactiva o activa la memoria de apariencia |
| `AUTEC_REID_SECONDS` | 5–3600 | Ventana de memoria (por defecto 120) |
| `AUTEC_REID_THRESHOLD` | 0.30–0.99 | Similitud mínima (por defecto 0.66) |
| `AUTEC_THREADS` | 1–4 | Hilos de inferencia (por defecto 2) |
| `AUTEC_EPP` | `0` / `1` | Desactiva o activa la inferencia EPP |
| `AUTEC_EPP_ONNX` | ruta | Modelo EPP ONNX (por defecto `models/epp_yolo11n.onnx`) |
| `AUTEC_EPP_MODEL` | ruta | Modelo EPP PyTorch de respaldo |
| `AUTEC_EPP_CONF` | 0.05–0.95 | Confianza mínima EPP (por defecto 0.25) |
| `AUTEC_EPP_IMGSZ` | 320–640 | Entrada EPP (por defecto 512) |
| `AUTEC_EPP_EVERY` | 1–10 | Infiere EPP cada N fotogramas (por defecto 2) |
| `AUTEC_FALLS` | `0` / `1` | Desactiva o activa la heurística de caídas en el backend |
| `AUTEC_FALLS_RATIO` | 0.5–3.0 | Umbral ancho/alto para riesgo (por defecto 1.05) |
| `AUTEC_FALLS_GRACE` | 0.5–60 | Segundos antes de confirmar una caída (por defecto 3) |
| `AUTEC_FALLS_COOLDOWN` | 0–3600 | Enfriamiento entre avisos por persona (por defecto 120) |
| `AUTEC_PORT` | 1–65535 | Puerto del servidor (por defecto 8000) |

Ejemplo en PowerShell:

```powershell
$env:AUTEC_THREADS = "1"
$env:AUTEC_REID_SECONDS = "300"
.venv\Scripts\python.exe server.py
```

> Las variables deben fijarse antes de arrancar el servidor. No se leen en caliente.

---

## 21. Capturas y dataset

### 21.1 Flujo

1. El usuario pulsa **Guardar en dataset** (interfaz clásica) o **Captura** (maqueta).
2. El navegador envía el JPEG actual.
3. El servidor valida y guarda.
4. Se crea un `.jpg` y un `.json` con metadatos.
5. Las capturas se listan en `/api/captures`.

### 21.2 Nombres

```text
YYYYMMDD_HHMMSS_mmm_label.jpg
YYYYMMDD_HHMMSS_mmm_label.json
```

Ejemplo:

```text
20261111_143208_123_entrada.jpg
20261111_143208_123_entrada.json
```

### 21.3 Metadatos

| Campo | Descripción |
|---|---|
| `filename` | Nombre del archivo |
| `capturedAt` | Fecha y hora ISO con zona |
| `label` | Etiqueta de escenario |
| `mode` | `camera` o `file` |
| `host` | IP de la cámara |
| `port` | Puerto |
| `resolution` | Resolución solicitada |
| `zone` | Nombre de la zona asociada a la alerta |
| `event` | Tipo de evento (`entry`, `dwell`, `count`, `queue`, `unattended`, `patrol`, `epp`, `mesa`, `fall`) |
| `profile` | Perfil EPP (`industrial`, `industrial-cliente`, `corporativo`) |
| `trackId` | Persona asociada a la alerta EPP o de caída |
| `missing` | Lista de prendas faltantes (`helmet`, `vest`) |
| `table` | Nombre de la mesa asociada a la alerta |
| `fallSeconds` | Segundos que la persona estuvo en riesgo antes de la alerta |
| `simulated` | `true` si la evidencia proviene de la demo simulada |
| `epp` | `true` si la captura está vinculada a EPP |
| `bytes` | Tamaño del JPEG |
| `appVersion` | Versión del servidor |

### 21.4 Plan de anotación

- Seleccionar imágenes representativas por escenario y condición de luz.
- Anotar cajas de `person`, `helmet`, `vest`.
- Marcar casos negativos: persona sin casco, persona sin chaleco.
- Revisar consistencia entre anotadores.
- Guardar el dataset fuera de `data/captures` para no mezclar crudo y etiquetado.
- Documentar la versión del dataset y los criterios.

### 21.5 Clases propuestas

| Clase | Descripción |
|---|---|
| `person` | Persona completa |
| `helmet` | Casco de seguridad |
| `vest` | Chaleco reflectante |
| `no_helmet` | Persona sin casco (opcional) |
| `no_vest` | Persona sin chaleco (opcional) |

Una alternativa es detectar solo `person`, `helmet` y `vest`, y deducir el cumplimiento por la presencia de EPP dentro de la caja de la persona. Esa lógica debe validarse con oclusiones.

**Implementación actual:** el detector acepta `person`, `helmet`, `vest` y las clases negativas opcionales, además de alias habituales (`hardhat`, `safety_vest`, etc.). La asociación usa el centro de la prenda: casco en el 45 % superior y chaleco entre el 15 % y el 85 % de la altura de la persona. El modelo puede omitir `person`; en ese caso se asocian las prendas a las cajas de persona que ya entrega YOLO11n COCO.

### 21.6 División recomendada

| Conjunto | Proporción | Uso |
|---|---|---|
| Entrenamiento | 70 % | Ajuste de pesos |
| Validación | 15 % | Selección de hiperparámetros |
| Prueba | 15 % | Métricas finales |

La división debe ser estratificada por escenario, iluminación y presencia de EPP.

### 21.7 Consideraciones

- Evitar imágenes duplicadas entre conjuntos.
- Incluir imágenes de personas de espaldas, de perfil y parcialmente ocluidas.
- Incluir distintos colores de casco y chaleco.
- No usar imágenes de personas sin consentimiento para difusión pública.
- Documentar la licencia de las imágenes públicas utilizadas.

## 22. Frontend y maqueta SaaS

### 22.1 Naturaleza

La carpeta `mockup/` contiene una **maqueta navegable** de la plataforma VigIA. No es un backend de producción:

- Los datos de empresas, planes, usuarios, auditoría y facturación son ficticios y viven en memoria.
- No hay autenticación real: el login no valida credenciales.
- Al recargar la página se restaura el estado inicial.
- La vista de **monitoreo** sí se conecta al backend local real para video, detecciones, capturas y snapshot.

### 22.2 Stack

- HTML5, CSS3 y JavaScript vanilla.
- Sin frameworks, sin bundler, sin `npm`.
- Iconos SVG propios (`icons.js`).
- Componentes reutilizables (`components.js`).
- Router por `hash` (`app.js`).
- Persistencia de preferencias en `localStorage`.
- Tipografías: IBM Plex Mono, IBM Plex Sans y Space Grotesk (Google Fonts).

### 22.3 Router y control de acceso

Rutas principales:

| Ruta | Vista | Rol |
|---|---|---|
| `#/` | Landing pública | Todos |
| `#/login` | Login demostrativo | Todos |
| `#/solicitar-acceso` | Solicitud de acceso | Todos |
| `#/admin` | Resumen del creador | `creator` |
| `#/admin/empresas` | Empresas | `creator` |
| `#/admin/empresas/:id` | Detalle de empresa | `creator` |
| `#/admin/planes` | Planes | `creator` |
| `#/admin/skills` | Skills | `creator` |
| `#/admin/solicitudes` | Solicitudes | `creator` |
| `#/admin/sesiones` | Sesiones | `creator` |
| `#/admin/auditoria` | Auditoría | `creator` |
| `#/admin/ajustes` | Ajustes | `creator` |
| `#/app` | Resumen de empresa | `company_admin`, `supervisor`, `operator` |
| `#/app/monitoreo` | Monitoreo | Todos los roles de empresa |
| `#/app/usuarios` | Usuarios | `company_admin`, `supervisor` |
| `#/app/skills` | Skills | `company_admin` |
| `#/app/plan` | Plan y facturación | `company_admin` |
| `#/app/ajustes` | Ajustes | `company_admin` |

Si el rol no tiene permiso, se muestra `V.noAccess()`.

### 22.4 Vistas públicas

**Landing (`V.landing`)**

- Navegación superior.
- Hero con propuesta de valor.
- Sección de características.
- Catálogo de 12 skills destacadas y referencia al catálogo completo de 48 skills para 13 industrias y drones.
- Sección de roles.
- Pasos de implementación.
- Llamada a la acción.
- Pie con contacto, privacidad y términos.

**Login (`V.login`)**

- Pestañas **Creador** y **Empresa**.
- Email y contraseña precargados (`demo`).
- Selector de empresa para el perfil empresa.
- Botones de acceso rápido.
- Aviso: “Los datos son ficticios y viven en memoria”.

**Solicitud de acceso (`V.requestAccess`)**

- Empresa, contacto, email, teléfono.
- Sector (13 industrias, drones u otro), usuarios estimados, plan de interés.
- Mensaje libre.
- Al enviar, la solicitud aparece en el panel del creador.
- Confirmación sin envío real de correo.

### 22.5 Consola del creador (admin)

| Vista | Contenido |
|---|---|
| **Resumen** | KPIs de empresas, usuarios, MRR y solicitudes; gráfico de ingresos; cobertura de industrias y plataformas; estado del sistema; empresas recientes; solicitudes; auditoría |
| **Empresas** | Búsqueda, filtros por estado y plan, tabla con contacto, sector, plan, asientos, vencimiento y MRR |
| **Detalle de empresa** | Ficha, skills, usuarios, pagos, sesiones y auditoría |
| **Planes** | Demo, Básico, Profesional y Corporativo; precios, asientos, duración y skills |
| **Skills** | Catálogo de 48 skills agrupadas por industria y drones, con filtros por categoría y estado, activación global y roadmap |
| **Solicitudes** | Pendientes de empresa, skill, asientos y renovación; aprobar o rechazar |
| **Sesiones** | Usuarios conectados, rol, empresa, IP, inicio y última actividad |
| **Auditoría** | Registro de acciones con actor, fecha, tipo, objetivo, empresa e IP |
| **Ajustes** | Preferencias del creador y de la plataforma |

### 22.6 Consola de empresa

| Vista | Contenido |
|---|---|
| **Resumen** | Cámara principal, estado del sistema, skills activas, eventos recientes, personas por hora y equipo |
| **Monitoreo** | Video en vivo, detecciones, métricas, zonas, personas, eventos, aforo por línea, mapa de calor, colas, puesto desatendido, control de rondas, mesas, caídas, barra, puestos libres, aforo de salas/aulas, aglomeraciones y nota técnica |
| **Usuarios** | Asientos, roles y permisos, listado y gestión |
| **Skills** | Skills incluidas en el plan; solicitud de nuevas |
| **Plan y facturación** | Plan actual, consumo, comparación de planes e historial de pagos |
| **Ajustes** | Perfil de empresa, cámara y preferencias |

### 22.7 Roles y permisos

| Permiso | `creator` | `company_admin` | `supervisor` | `operator` |
|---|---|---|---|---|
| Panel de administración | Sí | No | No | No |
| Resumen de empresa | — | Sí | Sí | Sí |
| Monitoreo | — | Sí | Sí | Sí |
| Usuarios | — | Sí | Sí | No |
| Skills | — | Sí | No | No |
| Plan y facturación | — | Sí | No | No |
| Ajustes | — | Sí | No | No |

### 22.8 Login demostrativo

- No hay contraseña real ni backend de autenticación.
- El perfil **Creador** entra como administrador de plataforma.
- El perfil **Empresa** permite elegir una empresa no suspendida.
- Los botones de acceso rápido evitan escribir credenciales.
- Los datos se reinician al recargar.

### 22.9 Integración con el backend real

`monitor.js` detecta la base de la API:

```javascript
// 1. Parámetro ?api=...
// 2. Si la página se abrió como file:// → http://127.0.0.1:8000
// 3. Si la maqueta corre en el puerto 8081 → http://127.0.0.1:8000
// 4. En caso contrario, mismo origen
```

Endpoints usados:

| Función | Endpoint | Frecuencia |
|---|---|---|
| Video | `/stream?host=...&port=...&res=...` | Continua |
| Detecciones | `/api/detections` | Cada 400 ms |
| Salud del stream | `/api/stream-health` | Cada 2 s |
| Captura | `/api/capture?...` | Bajo demanda |
| Snapshot | `/snapshot?...` | Bajo demanda |
| Prueba de cámara | `/api/probe?...` | Bajo demanda |

Comportamiento:

- Polling de detecciones cada 400 ms.
- Salud del stream cada 2 s.
- Si no hay fotogramas durante 6 s, se considera estancado.
- Hasta 8 reconexiones automáticas.
- `MAX_RECONNECT = 8`.
- El video MJPEG se muestra en un elemento `<img>`; las cajas se dibujan en un canvas superpuesto.

### 22.10 Diseño visual

- Tema oscuro, acento cian.
- Tipografía técnica: IBM Plex Sans para texto, IBM Plex Mono para datos y Space Grotesk para títulos.
- Componentes: tarjetas, tablas, badges, botones, modales, toasts, switches, barras de progreso.
- Diseño responsive.
- Accesibilidad: roles ARIA, etiquetas, foco visible, contraste.
- Animación de arranque (`splash.js`).

### 22.11 Persistencia en el navegador

| Clave | Contenido |
|---|---|
| `autecVision.camera.v1` | Configuración de la cámara activa |
| `autecVision.cameras.v1` | Perfiles de cámara |
| `autecVision.zones.v1` | Zonas, merodeo, colas, puestos desatendidos y rondas |
| `autecVision.line.v1` | Línea de aforo, capacidad y sentido |
| `autecVision.heatmap.v1` | Mapa de calor activado o desactivado |
| `autecVision.epp.v1` | Perfiles, regla EPP, gracia, enfriamiento, sonido y evidencia |
| `autecVision.tables.v1` | Mesas, objetivo de atención, enfriamiento y áreas |
| `autecVision.falls.v1` | Sensibilidad, gracia, enfriamiento y cajas de caídas |
| `autecVision.areas.v1` | Barra, puestos libres, aforo de salas/aulas y aglomeraciones por empresa |
| `autecVision.alertSound.v1` | Sonido de alertas activado o desactivado |

---

## 23. Modelo de datos SaaS

> Todos los datos son ficticios y se cargan desde `mockup/js/data.js`. No hay base de datos ni API de escritura.

### 23.1 Planes

| Plan | Precio | Período | Asientos | Skills |
|---|---|---|---|---|
| Demo | USD 0 | 14 días | 3 | Todas las skills disponibles |
| Básico | USD 79 | mensual | 5 | Personas, caídas, barra y aforo de salas |
| Profesional | USD 199 | mensual | 15 | Personas, ReID, Zonas, Merodeo, Aforo, Colas, Mapa de calor, Puesto desatendido, Rondas, EPP (piloto), Mesas, Caídas, Barra, Puestos libres, Aforo de salas/aulas y Aglomeraciones |
| Corporativo | USD 499 | mensual (facturación anual) | 30 | Personas, ReID, Zonas, Merodeo, Aforo, Colas, Mapa de calor, Puesto desatendido, Rondas, EPP (piloto), Mesas, Caídas, Barra, Puestos libres, Aforo de salas/aulas y Aglomeraciones |

### 23.2 Skills

El catálogo de la maqueta vive en `mockup/js/data.js` y se agrupa por industria. Cada skill tiene estado (`available`, `training`, `soon`), industrias, icono, progreso y empresas que la usan. El dashboard del creador permite filtrar por categoría y estado.

| Grupo | Skills | Disponibles | Estado |
|---|---:|---:|---|
| Transversales | 9 | 9 | Operación actual |
| Drones | 6 | 0 | 1 en entrenamiento · 5 próximas |
| Seguridad privada | 4 | 1 | Aglomeraciones disponible · 3 próximas |
| Retail | 3 | 0 | Próximamente |
| Industria | 3 | 1 | EPP disponible en piloto · 2 próximas |
| Logística | 3 | 0 | Patentes en entrenamiento · 2 próximas |
| Hostelería | 3 | 2 | Mesas y barra disponibles · 1 próxima |
| Salud | 3 | 1 | Caídas disponible · 2 próximas |
| Construcción | 2 | 0 | Próximamente |
| Oficinas | 2 | 2 | Puestos libres y aforo de salas disponibles |
| Educación | 2 | 1 | Aforo de aulas disponible · 1 próxima |
| Transporte | 2 | 0 | Próximamente |
| Agro | 2 | 0 | Próximamente |
| Energía y data centers | 2 | 0 | Próximamente |
| Banca | 2 | 0 | Próximamente |
| **Total** | **48** | **17** | **2 en entrenamiento · 29 próximas** |

Las diecisiete skills disponibles son detección de personas, ReID, zonas restringidas, merodeo, aforo por línea, colas, mapa de calor, puesto desatendido, control de rondas, EPP (piloto de casco y chaleco), mesas y clientes (piloto), detección de caídas (heurística local), barra, puestos libres, aforo de salas, aforo de aulas y aglomeraciones. Lectura de patentes y operación de dron siguen en entrenamiento (48 % y 35 %). El resto figura como Próximamente y no se puede activar.

**EPP en la maqueta.** CIM Seguridad y Planta Sur incluyen la skill. CIM puede alternar entre perfil `industrial-cliente` (casco + chaleco en sitio de cliente) y `corporativo` (solo chaleco en sede) sin recargar. La skill se muestra con badge **Piloto** y, mientras no exista el modelo entrenado, las métricas y badges usan simulación marcada.

**Mesas, caídas y áreas en la maqueta.** Retail Centro y Hotel Alba incluyen **Mesas y clientes**; Clínica del Valle incluye **Detección de caídas**. Hotel Alba suma **Barra** y **Aforo de salas**; Planta Sur suma **Puestos libres**; Constructora Andes suma **Aforo de aulas**; CIM Seguridad y Retail Centro suman **Aglomeraciones**. Todas se muestran con badge **Piloto**, guardan su configuración por empresa y usan simulación marcada cuando no hay cámara conectada. La ocupación de mesas, barra, puestos, salas, aulas y aglomeraciones se calcula con el centro inferior de la caja de persona; la caída usa la relación ancho/alto sostenida en el tiempo.

**Línea de drones.** El software puede ejecutarse sobre la cámara de un dron. De esa línea salen seis skills: operación de dron (entrenamiento), patrullaje perimetral, conteo aéreo de personas, EPP desde dron, inspección térmica e inspección de infraestructura. El catálogo del creador las muestra como una categoría propia y las empresas pueden solicitarlas según su sector.

### 23.3 Empresas semilla

| Empresa | Sector | Estado | Plan | Asientos | Usuarios | MRR |
|---|---|---|---|---|---|---|
| CIM Seguridad | Seguridad privada | Activa | Profesional | 15 | 8 | USD 199 |
| Logística Norte | Logística | Activa | Básico | 5 | 4 | USD 79 |
| Retail Centro | Retail | Prueba | Demo | 3 | 3 | USD 0 |
| Planta Sur | Industria | Activa | Profesional | 15 | 12 | USD 199 |
| Hotel Alba | Hostelería | Vencida | Básico | 5 | 5 | USD 0 |
| Constructora Andes | Construcción | Activa | Corporativo | 30 | 24 | USD 499 |
| Clínica del Valle | Salud | Activa | Básico | 5 | 5 | USD 79 |
| Puerto Nuevo | Logística | Suspendida | Profesional | 15 | 9 | USD 0 |

Total de usuarios: **70**. MRR de empresas activas: **USD 1 055**. CIM y Planta Sur tienen EPP habilitado; CIM usa el selector de perfil para distinguir sede corporativa de sitio industrial. Retail Centro y Hotel Alba incluyen Mesas y clientes; Clínica del Valle incluye Detección de caídas. Hotel Alba suma Barra y Aforo de salas; Planta Sur suma Puestos libres; Constructora Andes suma Aforo de aulas; CIM y Retail Centro suman Aglomeraciones.

### 23.4 Usuarios

- Se generan a partir de las empresas.
- Roles: `company_admin`, `supervisor`, `operator`.
- Estados: `active`, `inactive`.
- Cada empresa tiene un administrador y al menos un supervisor.
- Los correos usan el dominio de la empresa.

### 23.5 Sesiones

- 7 sesiones de ejemplo.
- Campos: usuario, empresa, rol, IP, hora de inicio y última actividad.
- Se muestran en el panel del creador.

### 23.6 Auditoría

- 12 registros de ejemplo.
- Acciones: aprobar solicitud, cambiar plan, crear usuario, nueva solicitud, suspender empresa, solicitar asientos, activar skill, plan vencido, crear empresa, registrar pago, iniciar sesión, rechazar solicitud.
- Campos: fecha, actor, acción, tipo, objetivo, empresa e IP.

### 23.7 Solicitudes

- 4 solicitudes pendientes:
  - Nueva empresa: Seguridad Integral Rosario (12 usuarios, Plan Profesional).
  - Skill: Retail Centro solicita Gestión de colas.
  - Asientos: Logística Norte solicita 2 usuarios adicionales.
  - Renovación: Hotel Alba solicita renovar Plan Básico por 12 meses.

### 23.8 Pagos

- Cada empresa con plan pago tiene tres pagos de ejemplo (octubre, septiembre, agosto).
- Campos: fecha, concepto, monto, método y estado.
- Las empresas en prueba no tienen pagos.

### 23.9 Notificaciones

- 3 notificaciones de ejemplo: nueva solicitud, plan por vencer y pago registrado.

### 23.10 Métricas

- Meses: junio a noviembre.
- MRR: 720, 810, 890, 940, 1010, 1055.
- Empresas: 4, 5, 5, 6, 7, 8.
- Usuarios: 38, 44, 51, 58, 64, 70.
- Personas por hora y ReID por hora para la vista de empresa.

---

## 24. Monitoreo, cámaras y zonas

### 24.1 Configuración del monitor

| Parámetro | Valor |
|---|---|
| Clave de almacenamiento | `autecVision.camera.v1` |
| Host por defecto | vacío |
| Puerto por defecto | `4747` |
| Resolución por defecto | `1280x720` |
| Resoluciones válidas | `1280x720`, `1920x1080`, `640x480` |
| Lentes | `unknown`, `back`, `front`, `external` |
| Reconexión automática | `true` |
| Poll de detecciones | 400 ms |
| Poll de salud | 2 s |
| Umbral de estancamiento | 6 s |
| Máximo de reconexiones | 8 |

### 24.2 Perfiles de cámara

- Clave: `autecVision.cameras.v1`.
- Campos: `id`, `name`, `host`, `port`, `resolution`, `lens`, `notes`.
- Nombre máximo: 40 caracteres.
- Notas máximas: 160 caracteres.
- Operaciones: crear, editar, eliminar, seleccionar activa, probar conexión (`/api/probe`).
- La cámara activa se usa en el monitoreo.

### 24.3 Zonas y skills por zona

- Clave: `autecVision.zones.v1`.
- Configuración por defecto:

```json
{
  "enabled": true,
  "merodeoEnabled": true,
  "dwellSeconds": 8,
  "zones": []
}
```

- Zona:

```json
{
  "id": "z-...",
  "name": "Zona 1",
  "color": "#22d3ee",
  "x": 0.1,
  "y": 0.1,
  "w": 0.3,
  "h": 0.4,
  "restricted": false,
  "alerts": {
    "entry": false,
    "dwell": true,
    "count": false
  },
  "maxPeople": 1,
  "queue": {
    "enabled": false,
    "maxWaitSeconds": 45
  },
  "unattended": {
    "enabled": false,
    "absenceSeconds": 60
  },
  "patrol": {
    "enabled": false,
    "intervalSeconds": 900,
    "toleranceSeconds": 300
  }
}
```

- Coordenadas normalizadas de 0 a 1.
- Tamaño mínimo: 0.02.
- Colores permitidos: `#22d3ee`, `#f5a524`, `#34d399`, `#60a5fa`, `#f87171`.
- `dwellSeconds`: 2–120 (por defecto 8).
- `maxPeople`: 1–50.
- `restricted` / `alerts.entry`: alarma de ingreso. Se puede desactivar en un checkpoint de paso.
- `alerts.entry`, `alerts.dwell` y `alerts.count`: alertas de ingreso, merodeo y conteo.
- `queue.maxWaitSeconds`: 5–600 s (por defecto 45).
- `unattended.absenceSeconds`: 5–3600 s (por defecto 60).
- `patrol.intervalSeconds`: 60–86 400 s (1–1440 min, por defecto 900 s).
- `patrol.toleranceSeconds`: 0–3600 s (0–60 min, por defecto 300 s).
- Tolerancia de salida de zona: 1.5 s.
- Retención visual de alerta: 6 s.
- Estadísticas: personas en zonas, alertas, por zona, por tipo, cola, puesto desatendido y ronda.

> Las zonas y sus skills se evalúan en el navegador con las detecciones que llegan de la API. La configuración se persiste en `localStorage`; las capturas de alerta se envían al backend y se guardan en `data/captures`.

### 24.4 Eventos del monitor

Tipos observados en la interfaz:

- `person`: persona detectada.
- `reid`: identidad recuperada.
- `zone`: ingreso o salida de zona.
- `merodeo`: permanencia prolongada.
- `count`: exceso de personas.
- `line`: cruce de línea de aforo, ingreso o salida.
- `queue`: demora o límite de cola.
- `unattended`: zona de trabajo sin personas.
- `patrol`: visita registrada o ronda vencida.
- `capture`: captura de alerta guardada.
- `system`: conexión, desconexión o error.

### 24.5 Límites de la integración

- El backend no calcula zonas; solo entrega cajas.
- El navegador decide si una caja está dentro de una zona y mantiene el estado de cada skill.
- Si se recarga la página, la configuración se conserva, pero los eventos y los estados de sesión se pierden.
- Las capturas de alerta se guardan en `data/captures` cuando el navegador tiene un fotograma disponible.
- No hay notificaciones externas.

---

## 25. Instalación y operación

### 25.1 Requisitos

- Windows 10 u 11.
- Python 3.10 o superior (probado con 3.14).
- DroidCam abierto en el teléfono.
- Teléfono y PC en la misma red.
- IP y puerto de DroidCam.
- `.venv` con Ultralytics, ONNX Runtime, OpenCV, PyTorch CPU y `lap`.
- Modelos en `models/`.

### 25.2 Instalación

```powershell
cd "D:\Autec\Proyectos\VigIA"
python -m venv .venv --system-site-packages
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install ultralytics onnxruntime opencv-python lap
.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 25.3 Arranque

**Opción 1: `run.bat`**

1. Verifica Python.
2. Comprueba que el puerto 8000 esté libre.
3. Abre el navegador a los 2 segundos.
4. Ejecuta `server.py`.

**Opción 2: manual**

```powershell
.venv\Scripts\python.exe server.py
```

**Opción 3: puerto alternativo**

```powershell
.venv\Scripts\python.exe server.py 8080
```

Luego abrir `http://localhost:8080`.

### 25.4 Configuración de DroidCam

1. Abrir DroidCam en el teléfono.
2. Conectar teléfono y PC a la misma red.
3. En la web, escribir IP y puerto (por defecto `4747`).
4. Elegir resolución.
5. Pulsar **Conectar**.
6. Si no se conoce la IP, pulsar **Buscar**.

> DroidCam permite una sola conexión de video. Si el cliente de Windows está conectado, la web no podrá tomar la cámara.

### 25.5 Resoluciones recomendadas

| Uso | Resolución |
|---|---|
| Visualización | `1280x720` |
| Análisis o equipos justos | `640x480` |
| Máxima calidad | `1920x1080` (si el equipo y la red lo soportan) |

### 25.6 Interfaz clásica

- Disponible en `/clasico`, `/legacy`.
- Es la interfaz funcional previa, con visor, configuración, capturas y modo de prueba.
- La interfaz principal es la maqueta SaaS en `/`.

Funciones de la interfaz clásica:

- Mostrar el video en vivo dentro de la web.
- Indicar estado: conectado, conectando, reconectando o error.
- Reconectar automáticamente si el stream se corta (hasta 12 intentos).
- Elegir la resolución del stream.
- Mostrar resolución real, FPS aproximados, tiempo al primer fotograma y reconexiones.
- Buscar la cámara en la red local.
- Pantalla completa.
- Descargar una captura JPEG.
- Guardar capturas y metadatos en `data/captures`.
- Probar imágenes y videos locales sin el teléfono.
- Detectar personas con YOLO11n ONNX.
- Asignar un ID estable con ByteTrack.
- Recuperar el ID con ReID dentro de 120 s.
- Dibujar cajas azules y etiquetas con ID y confianza.
- Mostrar el contador de personas con ID activo.
- Informar el estado de la detección en el panel.

Etiqueta de persona:

```text
persona #12 · 87%
```

Estados mostrados en el panel:

| Estado | Significado |
|---|---|
| “esperando video” | Aún no llegan fotogramas |
| “cargando modelo…” | La sesión ONNX se está inicializando |
| “activa · N personas · X FPS · Y ms” | Detección en funcionamiento |
| “sin fotogramas recientes” | El stream se detuvo |
| “sin respuesta del servidor” | La API no responde |
| “desactivada” | `AUTEC_DETECT=0` |
| “error” | Fallo de modelo, dependencia o inferencia |

Modo de prueba:

- Se activa con **Probar archivo**.
- Permite abrir una imagen o un video local.
- La barra de estado muestra **MODO PRUEBA**.
- **Desconectar** cierra el archivo y vuelve al estado normal.
- Sirve para preparar capturas, maquetas y validar el diseño de las cajas.

> El dashboard de la interfaz clásica es ilustrativo; solo el contador de personas es real.

### 25.7 Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| “No se pudo conectar” | DroidCam cerrado, IP incorrecta o redes distintas | Verificar DroidCam, IP, puerto y red |
| “DroidCam está ocupado” | Cliente de Windows conectado | Pulsar Stop o cerrar el cliente |
| “Cargando modelo…” | Primera inferencia lenta | Esperar; el video sigue funcionando |
| “Detección desactivada” | `AUTEC_DETECT=0` | Eliminar la variable y reiniciar |
| “Detección: error” | Modelo ausente o dependencia | Revisar consola, modelos y `lap` |
| Video entrecortado | Equipo cargado | Usar `640x480` y `AUTEC_THREADS=1` |
| La persona cambia de ID | Salió del plano o cambió de ropa | Ajustar `AUTEC_REID_SECONDS` o umbral |
| El contador baja y sube | Detecciones intermitentes | Revisar luz, distancia y oclusión |
| No se encuentra la cámara | Red equivocada o firewall | Escribir la IP manualmente |
| No reconecta | Se agotaron los intentos | Verificar DroidCam y pulsar Reconectar |
| El video se congela | WiFi inestable o ahorro de energía | Reconectar, revisar red y energía |
| El puerto 8000 está ocupado | Otra instancia | Cerrar la anterior o usar 8080 |

---

## 26. Rendimiento

### 26.1 Mediciones del README

| Configuración | Resultado aproximado |
|---|---|
| ONNX 416, 2 hilos | 400–600 ms por inferencia (~2 FPS) |
| ONNX 416, 1 hilo | 600–1000 ms por inferencia |
| Equipo o navegador muy cargado | 1.1–2.5 s por inferencia |

### 26.2 Contexto del equipo

- 2 núcleos lógicos.
- Sin GPU.
- Modelo ONNX de entrada fija 416 × 416.
- El video y la inferencia compiten por CPU.

### 26.3 Recomendaciones

- Usar `640x480` para el stream si el equipo va justo.
- Cerrar aplicaciones pesadas y pestañas.
- Probar `AUTEC_THREADS=1` si el video se entrecorta.
- No aumentar `imgsz` en `predict`: el ONNX tiene entrada fija.
- Mantener la detección en un hilo aparte.
- Usar ReID solo si se necesita; añade milisegundos, no otra red neuronal.

### 26.4 Métricas que debe medir la tesis

- FPS promedio y desviación.
- Latencia de inferencia (media, mediana, p95).
- Uso de CPU y memoria.
- Tiempo de arranque del modelo.
- Tiempo de reconexión.
- Impacto de ReID en el rendimiento.
- Comparación ONNX vs. PyTorch.

---

## 27. Pruebas realizadas y estado de validación

### 27.1 Pruebas manuales documentadas

> Las siguientes observaciones provienen del README y de pruebas informales de uso. **No constituyen una validación experimental formal**; la tesis debe repetirlas con protocolo, conjunto de prueba y registro de resultados.

| Prueba | Resultado observado |
|---|---|
| Arranque del servidor | Correcto en `127.0.0.1:8000` |
| Proxy de video DroidCam | Correcto |
| Detección de personas | Correcta con luz y distancia adecuadas |
| Seguimiento con ByteTrack | IDs estables mientras el rastro está activo |
| ReID por reentrada | Recupera ID dentro de 120 s en pruebas informales; falta validación formal |
| Captura de dataset | JPEG + JSON correctos |
| Reconexión | Hasta 12 intentos (interfaz clásica) |
| Búsqueda de cámara | Detecta equipos con el puerto 4747 |
| Modo de prueba con archivo | Correcto |
| Maqueta SaaS | Navegable, sin backend de datos |
| Monitoreo integrado | Video, detecciones, capturas y snapshot |
| Aforo por línea | Conteo IN/OUT y alerta por capacidad; pendiente validación en campo |
| Mapa de calor | Acumulación y dibujo sobre el video; sin alertas |
| Gestión de colas | Conteo, espera promedio y alerta por demora; pendiente validación en campo |
| Puesto desatendido | Alerta tras ausencia configurada y captura automática; pendiente validación en campo |
| Control de rondas | Estados, próxima visita, alerta única por ciclo y reset; lógica verificada con tiempo simulado, pendiente validación con cámara real |
| EPP (lógica) | 27 pruebas unitarias: alias de clases, asociación persona–prenda, observación positiva/negativa, normalización de cajas, suavizado y resumen. Ejecutar `python -m unittest tests.test_epp -v` |
| EPP (demo UI) | Tarjetas, KPI, cambio de perfil CIM, badges de simulación, alertas y captura con `event=epp`; pendiente validación visual formal |
| EPP (modelo real) | No evaluado: no hay dataset ni modelo entrenado |
| Mesas y clientes | Editor de rectángulos, ocupación por centro inferior, permanencia, alerta por objetivo, captura con `table` y simulación marcada; pendiente validación en salón real |
| Caídas (lógica) | 10 pruebas unitarias: caja vertical/horizontal, gracia, recuperación, ID inestable, poda y resumen. Ejecutar `python -m unittest tests.test_falls -v` |
| Caídas (demo UI) | Tarjeta, configuración por empresa, badges de riesgo, alerta y captura con `fallSeconds`; pendiente validación con videos etiquetados |
| Áreas (lógica) | 9 pruebas Node: barra, puestos, salas, aulas y aglomeraciones; capacidad, espera, gracia, enfriamiento, persistencia y reset. Ejecutar `node tests/areas.test.js` o `python -m unittest tests.test_areas -v` |
| Áreas (demo UI) | Tarjetas de resumen y monitoreo, editor de rectángulos, métricas, badges de simulación, toggle, alerta de prueba y captura con el evento de cada skill; validado en navegador a 1280 px y 390 px |

### 27.2 Pruebas no realizadas

- No hay conjunto de prueba etiquetado para personas.
- No hay métricas formales de mAP, precisión o recall.
- No hay pruebas estadísticas de ReID.
- No hay pruebas de carga con múltiples cámaras.
- No hay pruebas de seguridad ofensiva.
- No hay pruebas de usabilidad formales.
- No hay validación del modelo EPP porque todavía no existe.
- No hay dataset de caídas ni videos etiquetados para medir precisión y recall de la heurística.
- No hay validación de mesas con un salón real ni medición de atención en campo.
- No hay validación de barra, puestos, salas, aulas y aglomeraciones con cámaras y layouts reales; la revisión actual es funcional y de interfaz.

### 27.3 Plan de validación propuesto

1. **Línea base:** medir el sistema actual con un conjunto fijo de videos.
2. **Detección de personas:** anotar un conjunto de prueba y calcular mAP@0.5, precisión y recall.
3. **Seguimiento:** contar cambios de ID en recorridos guionizados.
4. **ReID:** simular salidas y reentradas; medir aciertos y falsos positivos.
5. **EPP:** construir y versionar el dataset, entrenar el modelo, validar con escenarios de casco/chaleco y completar `models/epp/metrics.json`. Mientras tanto, verificar solo la lógica con `tests/test_epp.py` y la demo marcada.
6. **Zonas:** validar ingreso, permanencia y conteo.
7. **Caídas:** etiquetar videos con caídas, sentados y agachados; medir precisión, recall y falsos positivos de la heurística y de un futuro modelo de pose.
8. **Mesas:** validar ocupación y permanencia con un salón real y distintos ángulos de cámara.
9. **Rendimiento:** medir FPS, latencia, CPU y memoria.
10. **Áreas:** validar barra, puestos, salas, aulas y aglomeraciones con videos etiquetados y layouts reales; medir error de conteo por área, falsos positivos por cruce de cajas y utilidad de la espera estimada.
11. **Usabilidad:** tareas con usuarios y cuestionario breve.

### 27.4 Criterios de aceptación sugeridos

| Criterio | Umbral propuesto |
|---|---|
| El video se mantiene fluido mientras detecta | Sin congelamientos > 2 s |
| La detección de personas es útil | mAP@0.5 ≥ 0,80 |
| El seguimiento es estable | ≤ 2 cambios de ID por recorrido |
| El ReID recupera reentradas claras | ≥ 80 % en condiciones controladas |
| El control de rondas detecta el vencimiento | 100 % de los ciclos simulados, con una sola alerta por ciclo |
| La lógica EPP asocia y suaviza correctamente | 100 % de las pruebas unitarias |
| La heurística de caídas respeta gracia y recuperación | 100 % de las pruebas unitarias |
| La ocupación de mesas coincide con la observación | ≥ 90 % en un salón controlado (pendiente de validación) |
| El motor de áreas respeta capacidad, gracia y enfriamiento | 100 % de las pruebas unitarias |
| El conteo por área coincide con la observación | ≥ 90 % en un layout controlado (pendiente de validación) |
| El modelo EPP real alcanza utilidad operativa | mAP@0.5 ≥ 0,75 por clase y accuracy de cumplimiento ≥ 85 % (pendiente de entrenamiento) |
| La captura guarda JPEG y JSON | 100 % de las pruebas |
| La reconexión funciona | Recupera tras corte de red |
| La interfaz es usable | ≥ 80 % de tareas completadas |

---

## 28. Privacidad, seguridad y ética

### 28.1 Privacidad

- El servidor escucha solo en `127.0.0.1`.
- El video no se envía a internet.
- No se usan servicios de reconocimiento facial.
- No se guardan rostros ni plantillas biométricas.
- La memoria de ReID vive en RAM y se borra al desconectar.
- EPP no usa reconocimiento facial: solo asocia cajas de casco y chaleco a la caja de una persona.
- Las capturas se guardan localmente con metadatos.
- El navegador no recibe el video de la cámara directamente: recibe el proxy local.

### 28.2 Seguridad

- No hay autenticación real; el sistema es para uso local.
- CORS abierto para desarrollo.
- No hay HTTPS.
- No hay control de acceso a `data/captures`.
- No hay cifrado en reposo.
- El puerto 8000 no debe exponerse a la red sin protección.

### 28.3 Ética

- Informar a los trabajadores sobre el monitoreo.
- No usar el sistema para sanciones automáticas.
- No inferir atributos sensibles.
- Revisar sesgos: el modelo puede fallar con piel oscura, ropa reflectante, oclusiones o poca luz.
- Garantizar revisión humana antes de cualquier decisión.
- Definir responsable, finalidad y tiempo de retención de las capturas.
- Cumplir la normativa laboral y de protección de datos aplicable.

### 28.4 Recomendaciones para un despliegue real

1. Agregar autenticación y roles en el backend.
2. Servir solo en una red controlada o mediante VPN.
3. Cifrar el disco o la carpeta de capturas.
4. Definir política de retención y borrado.
5. Registrar auditoría de accesos.
6. Documentar el consentimiento informado.
7. Validar el sistema con el personal de seguridad y salud.
8. No automatizar sanciones.

---

## 29. Limitaciones

### 29.1 Técnicas

- Sin GPU: ~2 FPS en el equipo de desarrollo.
- Modelo de entrada fija 416 × 416: no mejora con `imgsz` mayor.
- Una sola conexión de cámara a la vez.
- Sin base de datos ni persistencia de estados.
- Pruebas automatizadas limitadas a la lógica EPP; el resto se valida manualmente.
- Sin empaquetado ni instalador.
- Sin HTTPS ni autenticación.
- Sin soporte multiempresa real.
- Sin grabación de video.
- Integración EPP en backend y UI implementada, pero **sin modelo entrenado**: la demo usa simulación marcada y no mide cumplimiento real.
- El modelo EPP, cuando exista, puede fallar con oclusiones, personas muy juntas, casco en la mano o chaleco poco reflectivo.

### 29.2 Funcionales

- Las zonas y alertas viven en el navegador.
- La configuración EPP por empresa vive en `localStorage`; no se sincroniza entre equipos.
- El control de rondas no identifica al guardia ni valida un recorrido completo; cualquier persona que ingresa al checkpoint cuenta como visita.
- Los eventos se pierden al recargar.
- La maqueta SaaS no persiste datos.
- No hay notificaciones externas.
- No hay reportes exportables.
- No hay gestión real de usuarios.
- No hay integración con sistemas de seguridad existentes.

### 29.3 Metodológicas

- No hay dataset etiquetado formal.
- No hay métricas de precisión del detector actual.
- No hay escenarios de prueba estandarizados.
- No hay línea base comparativa con otras soluciones.
- No hay validación estadística.
- No hay evaluación de sesgos.

### 29.4 De documentación

- La maqueta se identifica como V0.1 en el login.
- No hay changelog.
- No hay licencia.
- No hay guía de contribución.
- No hay diagramas formales (UML, despliegue).

### 29.5 De producto

- La propuesta SaaS no tiene backend.
- Los planes y precios son ficticios.
- No hay pasarela de pago.
- No hay onboarding real.
- No hay soporte ni SLA.

### 29.6 Legales

- No hay aviso de privacidad ni términos reales.
- No hay consentimiento informado.
- No hay evaluación de impacto.
- No hay contrato de tratamiento de datos.
- `[VERIFICAR: normativa cubana aplicable]`

---

## 30. Roadmap

### 30.1 Fase 0.4.x — Estabilización

- Unificar versiones y changelog.
- Corregir README.
- Agregar pruebas básicas.
- Documentar API y parámetros.
- Mejorar mensajes de error.

**Criterio de salida:** documentación coherente y pruebas de humo.

### 30.2 Fase 0.5.0 — Zonas y alertas en el backend

- Definir zonas en el servidor.
- Evaluar ingreso, permanencia, conteo, colas, puestos desatendidos y rondas.
- Generar eventos con enfriamiento.
- Guardar evidencia (JPEG + JSON).
- Exponer eventos por API.
- Mostrar alertas en la interfaz.

**Criterio de salida:** una zona configurada genera eventos verificables y evidencia en disco.

### 30.3 Fase 0.6.0 — Modelo EPP entrenado y métricas

**Avance actual (piloto 0.4.x):**

- [x] Integrar un modelo EPP opcional en el detector.
- [x] Asociar casco y chaleco a cada persona.
- [x] Suavizar el estado por `trackId`.
- [x] Publicar EPP por persona y un resumen en `/api/detections`.
- [x] Definir reglas por empresa (`industrial`, `industrial-cliente`, `corporativo`).
- [x] Alertas, evidencia y demo marcada en la maqueta.
- [x] Pruebas unitarias de la lógica EPP.

**Pendiente:**

- [ ] Construir y versionar el dataset propio.
- [ ] Anotar casco y chaleco.
- [ ] Entrenar YOLO11n.
- [ ] Exportar ONNX.
- [ ] Evaluar mAP, precisión, recall y accuracy de cumplimiento.
- [ ] Instalar el modelo y reemplazar la simulación por detección real.

**Criterio de salida:** modelo de EPP con métricas documentadas y demo funcional sin simulación.

### 30.4 Fase 0.7.0 — Métricas y reportes

- Panel de métricas históricas.
- Exportación CSV/PDF.
- Reportes por turno y zona.
- Comparación de periodos.

**Criterio de salida:** reporte exportable con datos reales de sesión.

### 30.5 Fase 0.8.0 — Multicámara y multiempresa

- Perfiles de cámara en servidor.
- Múltiples streams.
- Asociación cámara–zona–empresa.
- Autenticación y roles reales.

**Criterio de salida:** dos cámaras simultáneas y aislamiento de datos por empresa.

### 30.6 Fase 1.0.0 — Endurecimiento

- HTTPS y autenticación.
- Persistencia en base de datos.
- Empaquetado e instalador.
- Ampliar la suite de pruebas automatizadas (hoy cubre la lógica EPP).
- Manual de usuario y de administrador.
- Política de privacidad y retención.

**Criterio de salida:** versión instalable, documentada y validada.

### 30.7 Correspondencia con la tesis

| Fase | Aporte a la tesis |
|---|---|
| 0.4.x | Estado del arte y línea base |
| 0.5.0 | Zonas, alertas y evidencia |
| 0.6.0 | Modelo EPP entrenado y métricas |
| 0.7.0 | Resultados y visualización |
| 0.8.0 | Escalabilidad |
| 1.0.0 | Propuesta de despliegue |

---

## 31. Inventario de parámetros

### 31.1 Detector

| Parámetro | Valor | Unidad | Configurable |
|---|---|---|---|
| `CONFIDENCE` | 0.35 | — | No (código) |
| `IMAGE_SIZE` | 416 | px | No (código) |
| `TARGET_INTERVAL` | 0.2 | s | No (código) |
| `MAX_FRAME_BYTES` | 4 194 304 | bytes | No (código) |
| `STALE_SECONDS` | 3.0 | s | No (código) |
| `TRACK_TTL` | 1.5 | s | No (código) |
| `TRACK_BUFFER` | 8 | frames | No (código) |
| `REID_MEMORY_SECONDS` | 120 | s | `AUTEC_REID_SECONDS` |
| `REID_THRESHOLD` | 0.66 | — | `AUTEC_REID_THRESHOLD` |
| `REID_MARGIN` | 0.05 | — | No (código) |
| `REID_GRACE_SECONDS` | 0.75 | s | No (código) |
| `REID_MAX_DESCRIPTORS` | 6 | — | No (código) |
| `REID_MAX_GALLERY` | 40 | — | No (código) |
| `AUTEC_THREADS` | 2 | hilos | Sí (1–4) |
| `AUTEC_DETECT` | 1 | — | Sí |
| `AUTEC_REID` | 1 | — | Sí |
| `AUTEC_EPP` | 1 | — | Sí |
| `EPP_CONFIDENCE` | 0.25 | — | `AUTEC_EPP_CONF` |
| `EPP_IMAGE_SIZE` | 512 | px | `AUTEC_EPP_IMGSZ` (320–640) |
| `EPP_EVERY` | 2 | frames | `AUTEC_EPP_EVERY` (1–10) |
| `EPP_SMOOTH_WINDOW` | 7 | observaciones | No (código) |
| `EPP_SMOOTH_THRESHOLD` | 0.6 | — | No (código) |
| `EPP_SMOOTH_ABSENCE` | 3 | observaciones | No (código) |

### 31.2 Servidor

| Parámetro | Valor | Unidad |
|---|---|---|
| `DEFAULT_PORT` | 8000 | puerto |
| `DEFAULT_CAMERA_PORT` | 4747 | puerto |
| `DEFAULT_RESOLUTION` | 1280x720 | px |
| `MAX_CAPTURE_BYTES` | 12 582 912 | bytes |
| `MAX_SNAPSHOT_BYTES` | 8 388 608 | bytes |
| `MAX_STREAM_BUFFER` | 12 582 912 | bytes |
| Bloque de lectura | 16 384 | bytes |
| Timeout de conexión | 6.0 | s |
| Timeout de probe | 3.0 | s |
| Timeout de snapshot | 8.0 | s |
| Descubrimiento | /24 | red |
| Hilos de descubrimiento | 64 | — |
| Timeout de descubrimiento | 0.25 | s |

### 31.3 Frontend

| Parámetro | Valor |
|---|---|
| `POLL_MS` | 400 ms |
| `HEALTH_MS` | 2000 ms |
| `STALL_SECONDS` | 6 s |
| `MAX_RECONNECT` | 8 |
| Resoluciones | 1280x720, 1920x1080, 640x480 |
| Lentes | unknown, back, front, external |
| Claves de storage | `autecVision.camera.v1`, `autecVision.cameras.v1`, `autecVision.zones.v1`, `autecVision.line.v1`, `autecVision.heatmap.v1`, `autecVision.alertSound.v1` |
| Zona mínima | 0.02 |
| Colores de zona | 5 |
| `dwellSeconds` | 2–120 |
| `maxPeople` | 1–50 |
| Espera máxima de cola | 5–600 s |
| Ausencia de puesto | 5–3600 s |
| Intervalo de ronda | 60–86 400 s (1–1440 min) |
| Tolerancia de ronda | 0–3600 s (0–60 min) |
| Salida de zona | 1.5 s |
| Retención de alerta | 6 s |

### 31.4 Modelo

| Parámetro | Valor |
|---|---|
| Arquitectura | YOLO11n |
| Formato | ONNX |
| Entrada | 416 × 416 |
| Clase | person (COCO 0) |
| Confianza | 0.35 |
| Runtime | ONNX Runtime CPU |
| Pesos | 10.6 MB (ONNX), 5.6 MB (PT) |

---

## 32. Glosario

| Término | Definición |
|---|---|
| **VigIA** | Nombre del proyecto y del repositorio. |
| **VigIA** | Nombre de la plataforma y de la marca. |
| **API** | Interfaz de programación de aplicaciones; en este caso, endpoints HTTP locales. |
| **ByteTrack** | Algoritmo de seguimiento multiobjeto que asocia detecciones de alta y baja confianza. |
| **COCO** | Dataset de objetos comunes usado para preentrenar YOLO. |
| **CPU-only** | Ejecución sin GPU. |
| **Dataset** | Conjunto de imágenes y etiquetas para entrenamiento y evaluación. |
| **Descriptor** | Vector que representa la apariencia de una persona. |
| **EPP** | Equipo de Protección Personal (casco, chaleco, guantes, gafas, etc.). |
| **Embedding** | Representación vectorial aprendida por una red neuronal. |
| **FPS** | Fotogramas por segundo. |
| **Histograma HSV** | Distribución de color en tono, saturación y valor. |
| **IoU** | Intersección sobre unión; mide el solapamiento de cajas. |
| **Latencia** | Tiempo entre la captura y la respuesta del sistema. |
| **mAP** | *Mean Average Precision*; métrica de detección. |
| **MJPEG** | Stream de video compuesto por imágenes JPEG sucesivas. |
| **MOT** | *Multi-Object Tracking*; seguimiento de múltiples objetos. |
| **ONNX** | Formato abierto para modelos de aprendizaje automático. |
| **ReID** | Reidentificación de una persona que reaparece. |
| **Snapshot** | Fotograma JPEG descargable. |
| **SPA** | *Single Page Application*; aplicación de una sola página. |
| **Tracker** | Algoritmo que asigna IDs persistentes a las detecciones. |
| **Transfer learning** | Reutilización de un modelo preentrenado en un dominio nuevo. |
| **Umbral** | Valor mínimo para aceptar una detección o coincidencia. |
| **YOLO** | *You Only Look Once*; familia de detectores de una etapa. |

---

## 33. Anexos

### Anexo A — Comandos útiles

```powershell
# Crear entorno
python -m venv .venv --system-site-packages

# Instalar dependencias
.venv\Scripts\python.exe -m pip install ultralytics onnxruntime opencv-python lap

# Instalar PyTorch CPU
.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Arrancar
.venv\Scripts\python.exe server.py

# Puerto alternativo
.venv\Scripts\python.exe server.py 8080

# Variables de entorno
$env:AUTEC_THREADS = "1"
$env:AUTEC_REID_SECONDS = "300"
$env:AUTEC_REID_THRESHOLD = "0.60"
$env:AUTEC_DETECT = "0"
$env:AUTEC_REID = "0"

# Ver capturas
Get-ChildItem data\captures
```

### Anexo B — Árbol resumido

```text
server.py
detector.py
run.bat
README.md
DOCUMENTACION.md
models/
  yolo11n.onnx
  yolo11n.pt
static/
  index.html
mockup/
  index.html
  css/autec.css
  js/*.js
data/
  captures/
```

### Anexo C — Respuesta completa de `/api/detections`

```json
{
  "ok": true,
  "active": true,
  "status": "running",
  "persons": 2,
  "visiblePersons": 2,
  "trackedPersons": 2,
  "uniquePersons": 4,
  "reidMatches": 1,
  "detections": [
    {
      "x1": 120.5,
      "y1": 80.2,
      "x2": 210.8,
      "y2": 390.4,
      "confidence": 0.91,
      "trackId": 1,
      "epp": {
        "helmet": true,
        "vest": false,
        "missing": ["vest"],
        "status": "missing",
        "simulation": false
      }
    },
    {
      "x1": 300.1,
      "y1": 95.7,
      "x2": 380.6,
      "y2": 402.9,
      "confidence": 0.84,
      "trackId": 3,
      "epp": {
        "helmet": true,
        "vest": true,
        "missing": [],
        "status": "ok",
        "simulation": false
      }
    }
  ],
  "epp": {
    "enabled": true,
    "available": true,
    "model": "epp_yolo11n.onnx",
    "reason": "",
    "persons": 2,
    "compliant": 1,
    "nonCompliant": 1,
    "unknown": 0,
    "withHelmet": 2,
    "withVest": 1,
    "withoutHelmet": 0,
    "withoutVest": 1,
    "compliance": 50.0
  },
  "width": 1280,
  "height": 720,
  "inferenceMs": 512.4,
  "fps": 1.9,
  "updatedAt": 1760000000.0,
  "ageSeconds": 0.15,
  "error": "",
  "model": "YOLO11n ONNX · COCO + ByteTrack + ReID"
}
```

### Anexo D — Checklist para la tesis

- [ ] Título aprobado por la facultad.
- [ ] Tutor asignado.
- [ ] Problema y pregunta de investigación redactados.
- [ ] Objetivos general y específicos aprobados.
- [ ] Alcance y limitaciones explícitos.
- [ ] Marco teórico con fuentes verificadas.
- [ ] Metodología descrita.
- [ ] Arquitectura y diagramas.
- [ ] Dataset documentado.
- [ ] Métricas de detección.
- [ ] Métricas de seguimiento.
- [ ] Métricas de ReID.
- [ ] Métricas de rendimiento.
- [ ] Pruebas de usabilidad.
- [ ] Consideraciones éticas y legales.
- [ ] Conclusiones y recomendaciones.
- [ ] Referencias según norma.
- [ ] Anexos y manual de usuario.

### Anexo E — Datos pendientes o por verificar

| Dato | Estado |
|---|---|
| Nombre del tutor | Pendiente |
| Título definitivo | Propuesto, sujeto a aprobación |
| Norma de citación | Por definir |
| Resolución cubana de seguridad laboral | Verificar |
| Licencia del proyecto | Por definir |
| Tamaño y composición del dataset | Por definir |
| Clases finales de EPP | Por definir |
| Metas numéricas | Por definir tras línea base |
| Presupuesto detallado | Por completar |
| Cronograma | Omitido por indicación del autor |
| Fecha de defensa | Por definir |
| Tribunal | Por definir |

### Anexo F — Cómo usar este documento con otra IA

Este documento está pensado para ser entregado como fuente única. Un prompt de traspaso sugerido:

```text
Actúa como asesor de tesis de Ingeniería Automática. Te entrego un documento
base con toda la información del proyecto VigIA. Con esos datos y los
parámetros que te daré a continuación, ayúdame a mejorar el anteproyecto de
Trabajo de Diploma.

Reglas:
1. Usa solo la información del documento; no inventes métricas, fechas ni
   resultados.
2. Marca explícitamente los datos que falten como [COMPLETAR].
3. Mantén el enfoque académico y el alcance real del prototipo.
4. No presentes la detección real de EPP como implementada: hay integración y demo simulada, pero falta el modelo entrenado.
5. Distingue entre prototipo funcional y maqueta SaaS.
6. Respeta el contexto: CUJAE, Facultad Automática y Biomédica, Ingeniería
   Automática, La Habana, curso 2026–2027, 4to año terminal.
7. Propón mejoras de redacción, estructura y argumentación, sin cambiar los
   hechos técnicos.

Parámetros adicionales: [INSERTAR AQUÍ LOS PARÁMETROS DEL AUTOR]
```

### Anexo G — Resumen factual en una tabla

| Hecho | Dato |
|---|---|
| Versión funcional | 0.4.0 |
| Modelo | YOLO11n ONNX 416 × 416 |
| Confianza | 0.35 |
| Clase detectada | person (COCO 0) |
| Tracking | ByteTrack, buffer 8 |
| ReID | Histogramas HSV, 120 s, umbral 0.66 |
| FPS reales | ~2 en el equipo de desarrollo |
| Inferencia | 400–600 ms (2 hilos) |
| Servidor | 127.0.0.1:8000 |
| Cámara | DroidCam :4747 |
| Capturas | `data/captures` |
| Interfaz principal | `mockup/` |
| Interfaz clásica | `static/index.html` |
| Pruebas automatizadas | Sí: 27 pruebas de lógica EPP |
| Base de datos | No |
| Autenticación real | No |
| EPP implementado | Integración y demo; modelo no entrenado |
| Zonas en backend | No (solo navegador) |

---

**Fin del documento.**

> Este documento resume el estado real del proyecto al 16 de noviembre de 2026. Para la tesis, complementar con los datos marcados como pendientes y verificar las referencias normativas antes de la defensa.
