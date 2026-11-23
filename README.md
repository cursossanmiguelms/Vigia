# VigIA — Visión local con detección de personas

Prototipo local que muestra el video de **DroidCam** en una interfaz web y detecta personas con **YOLO11n + ByteTrack**. Una memoria de apariencia local permite que una persona recupere su número cuando vuelve a entrar al plano. Todo el procesamiento ocurre en el PC: el video no se envía a internet ni se usa reconocimiento facial.

Versión actual: **0.5.0** (detección, seguimiento, memoria de apariencia, zonas con alertas, perfiles de cámara, aforo, colas, mapa de calor, puestos desatendidos, control de rondas, **piloto EPP** de casco y chaleco, **mesas y clientes**, **detección de caídas** y **persistencia en Supabase**).

## Requisitos

- Windows 10 u 11.
- Python 3.10 o superior. Probado con Python 3.14.
- DroidCam abierto en el teléfono.
- Teléfono y PC conectados a la misma red.
- La IP y el puerto que muestra DroidCam.
- Para la detección local:
  - `.venv` con Ultralytics, ONNX Runtime, OpenCV y PyTorch CPU.
  - `lap`, necesario para ByteTrack.
  - Los modelos `models/yolo11n.onnx` y `models/yolo11n.pt`.
  - Opcional para EPP real: `models/epp_yolo11n.onnx` o `models/epp_yolo11n.pt`. Sin este archivo, la interfaz usa simulación marcada y el backend informa `model-missing`.

## Instalación

El proyecto ya incluye un entorno `.venv` preparado. Si necesitas recrearlo:

```powershell
cd "D:\Autec\Proyectos\Autec Vision"
python -m venv .venv --system-site-packages
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install ultralytics onnxruntime opencv-python lap
```

Si PyTorch no está instalado en el sistema, instala la versión CPU:

```powershell
.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

Los modelos deben estar en:

```text
models/yolo11n.onnx      ← modelo principal, más rápido
models/yolo11n.pt        ← respaldo si falta el ONNX
models/epp_yolo11n.onnx  ← opcional: casco y chaleco (EPP)
models/epp_yolo11n.pt    ← respaldo EPP si falta el ONNX
```

## Cómo arrancar

1. Haz doble clic en `run.bat`.
2. Se abrirá una ventana de consola y, después de 2 segundos, el navegador.
3. Si el navegador no se abre, entra manualmente a:

```text
http://localhost:8000
```

4. Abre la configuración de cámara, escribe la IP del teléfono y el puerto:

```text
IP:      172.20.10.2
Puerto:  4747
```

5. Elige la resolución. Para ver usa `1280 × 720`; para analizar o ahorrar recursos usa `640 × 480`.
6. Pulsa **Conectar**.

Si el puerto `8000` está ocupado, arranca directamente:

```powershell
.venv\Scripts\python.exe server.py 8080
```

Y abre `http://localhost:8080`.

Si no sabes la IP actual, pulsa **Buscar**. La app escanea la red local y busca equipos con el puerto `4747` abierto. Puede tardar unos segundos.

La reconexión automática está activada por defecto. Si el teléfono se duerme o el WiFi se corta, la app intenta reconectar hasta 12 veces con espera creciente.

## Supabase y acceso

Supabase es la **única fuente de verdad** de VigIA. No hay login falso, fecha simulada ni datos de ejemplo: si Supabase no responde, la interfaz muestra el error y listas vacías. El modo demo solo existe si se activa de forma explícita con `?demo=1` o `localStorage['vigia.demo'] = '1'`.

1. Copia `.env.example` como `.env` y completa las claves del proyecto. **Nunca subas `.env`.**
2. Aplica las migraciones (requiere `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF`):

```powershell
.venv\Scripts\python.exe scripts\apply_supabase_sql.py supabase\migrations\20261122000100_vigia_init.sql
.venv\Scripts\python.exe scripts\apply_supabase_sql.py supabase\migrations\20261123000200_vigia_auth_simple.sql
.venv\Scripts\python.exe scripts\apply_supabase_sql.py supabase\migrations\20261123000300_vigia_cleanup_demo_data.sql
```

3. Define la contraseña del administrador inicial:

```powershell
.venv\Scripts\python.exe scripts\set_password.py admin@vigia.local 'VigIA2026!'
```

4. Arranca el servidor con `run.bat` y entra en `http://localhost:8000`.

### Usuario inicial

| Email | Contraseña temporal |
|---|---|
| `admin@vigia.local` | `VigIA2026!` |

Cámbiala en cuanto entres. Las contraseñas se guardan como hashes PBKDF2 en `profiles.password_hash`; nunca viajan al navegador. Las sesiones viven en `sessions` y se entregan como una cookie `HttpOnly` de 24 h (`SameSite=Lax`, `Secure` cuando la petición llega por HTTPS).

### Qué se guarda

- Empresas, planes, usuarios, skills, solicitudes, sesiones, auditoría, notificaciones y pagos.
- Cámaras, zonas y toda la configuración que antes vivía solo en `localStorage` (`app_configs`).
- Capturas (Storage bucket `captures`) y su metadata.
- Eventos de alerta (`alert_events`) y snapshots de métricas (`monitoring_metrics`).

Las lecturas se hacen con la *publishable key*; **todas las escrituras** (`/api/db`, `/api/events`, `/api/metrics`, `/api/capture`) exigen sesión y pasan por el backend con la *service role key*. El navegador nunca ve secretos. Las políticas RLS actuales permiten `SELECT` a `anon`/`authenticated` para alimentar dashboards; se endurecerán en una fase posterior.

## Arquitectura

```text
Teléfono (DroidCam)
        │  stream MJPEG
        ▼
server.py  ──────────────►  navegador (video original)
        │
        │  copia de cada JPEG
        ▼
detector.py (hilo aparte)
        │  YOLO11n ONNX + ByteTrack + memoria de apariencia
        ▼
GET /api/detections  ◄──── navegador cada 400 ms
        │
        ▼
canvas transparente con cajas y etiquetas
```

Puntos importantes:

- El servidor es el **único cliente** de DroidCam. No se abre una segunda conexión.
- El navegador recibe el stream original sin modificar.
- El detector recibe copias de los fotogramas JPEG completos.
- La cola del detector tiene capacidad 1: si la inferencia va lenta, se descarta el fotograma viejo.
- Las cajas se dibujan en el navegador, no en el servidor.
- El servidor escucha solo en `127.0.0.1`.

## Detección, seguimiento y memoria de apariencia

- Modelo: **YOLO11n** exportado a ONNX con entrada fija de **416 × 416**.
- Clase detectada: `person` (COCO).
- Confianza mínima: `0.35`.
- Seguimiento: **ByteTrack** de Ultralytics.
- Cada persona recibe un `trackId` visible; ByteTrack mantiene el seguimiento interno.
- El contador usa los IDs activos, no el número de cajas del último fotograma.
- Un ID sigue contando durante **1.5 segundos** aunque una detección aislada falle.
- ByteTrack conserva un ID perdido durante **8 fotogramas** (entre 2 y 4 segundos a 2–4 FPS).
- **Memoria de apariencia local:** si la persona sale y vuelve a entrar, recupera su número durante **120 segundos**.
- La recuperación también cubre reentradas rápidas, aunque ByteTrack todavía no haya liberado el rastro anterior.
- La memoria compara el color de la ropa (histograma HSV del torso y del cuerpo) y exige un margen frente a la segunda persona más parecida.
- Si dos personas visten ropa casi idéntica, o la apariencia cambia mucho, la app prefiere asignar un ID nuevo antes que confundirlas. No es reconocimiento facial.
- Los IDs se reinician al desconectar y volver a conectar la cámara.
- Objetivo: ~5 inferencias por segundo. En este equipo se obtienen ~2 FPS reales con el modelo ONNX.
- La primera inferencia tarda varios segundos porque carga la sesión ONNX; el video sigue funcionando mientras tanto.

La etiqueta de cada persona muestra el ID y la confianza:

```text
persona #12 · 87%
```

El contador del HUD muestra las personas con ID activo. El texto inferior del panel indica el estado:

- “esperando video”
- “cargando modelo…”
- “activa · N personas · X FPS · Y ms”
- “sin fotogramas recientes”
- “sin respuesta del servidor”
- “desactivada”
- “error”

## Zonas, alertas y perfiles de cámara

Las zonas se dibujan sobre el video como rectángulos en coordenadas normalizadas (`x`, `y`, `w`, `h` de 0 a 1). Cada zona tiene nombre, color y seis opciones independientes:

- **Área restringida:** avisa cuando una persona entra a la zona. Es la opción activada por defecto y muestra el mensaje “Persona no autorizada ingresando a …”.
- **Merodeo:** avisa cuando una persona permanece dentro más de `dwellSeconds` (8 segundos por defecto), con una gracia de salida de 1.5 segundos.
- **Conteo:** avisa cuando hay `maxPeople` o más personas dentro de la zona.
- **Cola:** mide la cantidad de personas y el tiempo de espera dentro de la zona. Avisa cuando una persona supera `queue.maxWaitSeconds` o cuando la cola llega a `maxPeople`. La tarjeta muestra la cantidad actual y la espera promedio; el estado interno también calcula la espera máxima.
- **Puesto desatendido:** avisa cuando la zona queda sin personas durante `unattended.absenceSeconds`. La tarjeta muestra los segundos sin cobertura y el estado `Cubierto` / `ALERTA`.
- **Control de rondas:** convierte la zona en un checkpoint con intervalo y tolerancia configurables. Cualquier persona que ingrese cuenta como visita; si no hay visita a tiempo, se dispara la alerta.

La evaluación usa el punto inferior-central de cada caja y el `trackId`. Si el detector no entrega un `trackId`, el cliente asigna IDs estables por solapamiento (IoU). Las alertas se muestran en un banner dentro del video, suenan con Web Audio y aparecen como aviso. El sonido se puede apagar y el botón **Probar** de cada zona permite verificar el aviso sin esperar a una persona.

Cada alerta de área restringida, conteo, cola, puesto desatendido o ronda guarda además una **captura automática** en `data/captures`. La imagen incluye la zona resaltada en rojo, las cajas de las personas, el texto de la alarma y la hora. El archivo se guarda con la etiqueta `alerta` y un JSON con `zone` y `event`; las pruebas manuales usan la etiqueta `prueba`.

La configuración se guarda en `localStorage`:

```text
autecVision.zones.v1      ← zonas, merodeo, cola, puesto desatendido, rondas y alertas
autecVision.line.v1       ← línea de aforo, capacidad y sentido
autecVision.heatmap.v1    ← mapa de calor activado o desactivado
autecVision.epp.v1        ← perfiles, regla EPP, gracia, enfriamiento y evidencia
autecVision.tables.v1     ← mesas, objetivo de atención, enfriamiento y áreas
autecVision.falls.v1      ← sensibilidad, gracia, enfriamiento y cajas de caídas
autecVision.areas.v1      ← barra, puestos libres, aforo de salas/aulas y aglomeraciones
autecVision.alertSound.v1 ← sonido activado o desactivado
autecVision.cameras.v1    ← perfiles y cámara activa
```

Los **perfiles de cámara** permiten guardar varias fuentes de DroidCam (IP, puerto, resolución, lente y notas) y cambiar cuál se monitorea. DroidCam entrega un solo stream por vez, así que solo hay una cámara activa. Las zonas se comparten entre perfiles.

### Cambio de lente

- **DroidCam OBS:** VigIA usa su API v1 (`GET /v1/camera/camera_list` y `PUT /v1/camera/active/{index}`) para cambiar el lente real desde la web. El botón **Lente** del gestor lo aplica y el cambio se intenta al guardar el perfil o activar una cámara con lente definido.
- **DroidCam clásico:** no expone un endpoint HTTP para cambiar de lente. Hay que usar **Camera Swap** en el teléfono y después actualizar el campo de lente del perfil. El servidor devuelve `supported: false` con instrucciones cuando detecta DroidCam clásico (404 o HTML).

## EPP (casco y chaleco)

El piloto de EPP evalúa por persona si lleva **casco** y **chaleco**. La detección es global, pero la regla de alerta se define por empresa y por perfil de operación:

| Perfil | Empresa de ejemplo | EPP exigido |
|---|---|---|
| `industrial` | Planta Sur | Casco + chaleco |
| `industrial-cliente` | CIM en un sitio industrial | Casco + chaleco |
| `corporativo` | CIM en su sede | Solo chaleco |

CIM puede alternar entre **Sitio industrial** y **Sede corporativa** desde la tarjeta de EPP, sin recargar la página ni cambiar el backend. La configuración se guarda por empresa en `localStorage` (`autecVision.epp.v1`) e incluye gracia antes de alertar, enfriamiento entre alertas, sonido, evidencia y sub-cajas.

### Estado real del modelo

- **Todavía no hay un modelo EPP entrenado en el repositorio.** `models/` solo contiene el detector de personas.
- Sin `models/epp_yolo11n.onnx` ni `models/epp_yolo11n.pt`, el backend publica `epp.enabled=false` y `epp.reason="model-missing"`.
- En ese caso la maqueta usa un modo de **simulación determinística** por `trackId`, marcado con badges `SIMULACIÓN` y cajas punteadas. Sirve para validar la interfaz, las reglas y la demo, **no** para medir cumplimiento real.
- Cuando el modelo esté instalado, el backend lo carga en forma opcional y la interfaz cambia el badge a `EN VIVO`. El video sigue procesándose localmente.

Para entrenar el modelo hay una guía en `models/epp/README.md`.

La lógica de asociación, suavizado, normalización y resumen se valida con pruebas unitarias:

```powershell
python -m unittest tests.test_epp -v
```

### Cómo funciona la detección

- Se reutiliza el frame JPEG que ya recibe el detector de personas.
- La inferencia EPP es opcional y corre cada `AUTEC_EPP_EVERY` fotogramas (2 por defecto) para no duplicar el costo en CPU.
- El casco se asocia a la persona si su centro cae en el 45 % superior de la caja.
- El chaleco se asocia si su centro cae entre el 15 % y el 85 % de la altura.
- Se aceptan variantes de clases (`hardhat`, `safety_helmet`, `safety_vest`, `reflective_vest`, `casco`, `chaleco`, etc.) y clases negativas (`no_helmet`, `no_vest`).
- Un suavizado por `trackId` evita parpadeos: una ausencia debe repetirse 3 observaciones y una presencia necesita mayoría de la ventana de 7.
- Si solo se confirma una prenda, el estado es `partial` y cuenta como `unknown` en el resumen; cada empresa decide si eso alcanza o no.
- La regla de alerta se aplica en el navegador: el backend informa casco y chaleco, y la empresa define qué exigir.

### Alertas y evidencia

- La alerta se dispara cuando falta el EPP exigido durante `graceSeconds` (5 s por defecto).
- El enfriamiento por persona es `cooldownSeconds` (60 s por defecto).
- Se muestra un banner dentro del video y un aviso. El sonido se puede desactivar.
- La captura automática se guarda en `data/captures` con `event=epp` y metadatos `profile`, `trackId`, `missing` y `simulated`.
- El botón **Probar** de la tarjeta permite verificar el aviso sin esperar una detección real.

### Guion de demo

1. Entrar como creador y abrir **Planta Sur**.
2. En el resumen, mostrar la tarjeta y el KPI **Cumplimiento EPP**.
3. Ir a **Monitoreo**, activar EPP, mostrar las sub-cajas y usar **Probar** para disparar banner, sonido y captura.
4. Verificar en `data/captures` el JSON con `event=epp`, `profile=industrial`, `missing` y `simulated`.
5. Abrir **CIM Seguridad**, alternar **Sitio industrial** / **Sede corporativa** y comprobar que en sede solo se exige chaleco.
6. Aclarar que, sin modelo entrenado, el badge `SIMULACIÓN` indica que la detección no es real.

### Privacidad

EPP no usa reconocimiento facial ni identifica a la persona. Solo asocia cajas de casco y chaleco a la caja de una persona y aplica una regla de la empresa. El video y las capturas quedan en el PC.

## Mesas y clientes

La skill **Mesas y clientes** estima la ocupación de mesas o sectores del salón y mide cuánto tiempo permanece ocupada cada mesa. Se habilita por empresa (Retail Centro y Hotel Alba en la demo) y se configura desde el resumen o desde **Monitoreo**.

### Cómo funciona

- Cada mesa es un rectángulo relativo al cuadro (`x`, `y`, `w`, `h`), igual que las zonas.
- Una persona ocupa una mesa cuando el **centro inferior** de su caja cae dentro del rectángulo.
- La ocupación y la permanencia se calculan en el navegador; el backend solo entrega las cajas de personas.
- Si una mesa supera el **objetivo de atención** (`attentionSeconds`, 10 minutos por defecto), se dispara un banner, suena un aviso y se guarda una captura con el nombre de la mesa.
- El enfriamiento (`cooldownSeconds`, 180 s por defecto) evita repetir la alarma mientras la mesa sigue ocupada.
- Al liberarse una mesa que estuvo ocupada al menos 30 segundos, se registra el evento **Mesa liberada** con la permanencia total.

### Editor y configuración

El botón **Editar** abre un editor sobre el último fotograma. Se dibuja un rectángulo, se le asigna nombre, color y cantidad de comensales, y se ajustan el objetivo de atención, el enfriamiento y la visibilidad de las áreas. La configuración se guarda por empresa en `localStorage` (`autecVision.tables.v1`) y las coordenadas se mantienen al cambiar la resolución del video.

La tarjeta muestra **Ocupadas**, **Libres**, **Ocupación**, **Clientes**, **Atención promedio** y **Alertas**. En la demo sin cámara los valores son una **simulación marcada**; con la cámara conectada se calculan con las detecciones reales.

### Privacidad

No se identifica a clientes ni al personal: solo se cuenta cuántas personas hay dentro de cada rectángulo y cuánto tiempo permanecen. Las capturas de alerta quedan en `data/captures` con `table` y `event=mesa`.

## Detección de caídas

La skill **Detección de caídas** identifica personas caídas o en situación de riesgo con una **heurística local de caja**, sin modelo de pose. Se habilita por empresa (Clínica del Valle en la demo) y se configura desde el resumen o desde **Monitoreo**.

### Cómo funciona

- Se calcula la relación **ancho/alto** de la caja de cada persona.
- Si la relación supera el umbral de sensibilidad (`1.05` en sensibilidad media), la persona queda **en riesgo**.
- Si la condición se mantiene durante `graceSeconds` (3 s por defecto), se confirma una **posible caída** y se dispara la alarma.
- El **enfriamiento** por persona (`cooldownSeconds`, 120 s por defecto) evita repetir el aviso.
- Cuando la caja vuelve a ser vertical, se registra **Persona de pie nuevamente**.
- El backend aplica la misma heurística sobre las cajas de ByteTrack y publica el resumen `falls` en `/api/detections`; el navegador puede ajustar sensibilidad y gracia por empresa.

La sensibilidad se puede cambiar entre **Baja** (solo cajas muy horizontales), **Media** y **Alta** (detecta antes, con más falsos positivos). La configuración se guarda en `autecVision.falls.v1`.

### Alcance y límites

Es una ayuda operativa, no un diagnóstico. Puede fallar con personas sentadas, agachadas, de espaldas o con cámaras muy inclinadas; tampoco detecta caídas fuera del cuadro. La gracia y el enfriamiento reducen el ruido. No se usa un modelo de pose ni se envía video a internet.

La heurística se valida con pruebas unitarias:

```powershell
python -m unittest tests.test_falls -v
```

Las capturas de alerta se guardan en `data/captures` con `event=fall` y `fallSeconds`.

## Ocupación por áreas: barra, puestos, salas, aulas y aglomeraciones

Cinco skills comparten un mismo motor de áreas rectangulares. Se habilitan por empresa y se configuran desde el resumen o desde **Monitoreo**:

| Skill | Empresas demo | Qué mide | Modo |
|---|---|---|---|
| **Ocupación de barra** | Hotel Alba | Personas en barra, espera y capacidad | `wait` |
| **Puestos libres** | Planta Sur | Escritorios ocupados y libres | `desks` |
| **Aforo de salas** | Hotel Alba, Clínica del Valle | Personas por sala contra su aforo | `capacity` |
| **Aforo de aulas** | Constructora Andes | Personas por aula contra su aforo | `capacity` |
| **Aglomeraciones** | CIM Seguridad, Retail Centro | Concentración de personas en accesos, hall o salidas | `crowd` |

### Cómo funciona

- Cada área es un rectángulo relativo al cuadro (`x`, `y`, `w`, `h`) con nombre, color y capacidad propia.
- Una persona cuenta en el área cuando el **centro inferior** de su caja cae dentro del rectángulo. Es la misma referencia que usan zonas y mesas.
- **Barra** marca atención cuando la espera supera el objetivo (`waitSeconds`) o cuando el grupo excede la capacidad. La espera se estima desde que llega la primera persona hasta que el área queda libre.
- **Puestos libres** cuenta personas por puesto y descuenta la capacidad total para estimar puestos libres.
- **Salas y aulas** alertan cuando el conteo supera el aforo durante `graceSeconds`.
- **Aglomeraciones** alerta cuando el conteo alcanza o supera el umbral del punto durante la gracia.
- El **enfriamiento** (`cooldownSeconds`) evita repetir la alarma mientras el área sigue en exceso.
- El cálculo es geométrico: no identifica personas, no mide distancia interpersonal y no distingue clientes de personal.

### Editor y configuración

El botón **Editar** abre un editor sobre el último fotograma. Se dibuja un rectángulo, se le asigna nombre y capacidad, y se ajustan la espera objetivo (solo barra), la gracia, el enfriamiento y la visibilidad de las áreas. La configuración se guarda por empresa y skill en `localStorage` (`autecVision.areas.v1`) y las coordenadas se mantienen al cambiar la resolución del video.

La tarjeta muestra métricas por modo: personas, áreas ocupadas, espera máxima, capacidad, ocupación y alertas. En la demo sin cámara los valores son una **simulación marcada**; con la cámara conectada se calculan con las detecciones reales.

### Privacidad y pruebas

Todo el cálculo queda en el navegador y en el backend local. Las capturas de alerta se guardan en `data/captures` con el evento de la skill (`barra`, `puesto`, `sala`, `aula` o `aglomeracion`).

El motor se valida sin navegador con Node:

```powershell
node tests\areas.test.js
python -m unittest tests.test_areas -v
```

## Aforo, colas, mapa de calor, puesto desatendido y rondas

La pantalla de monitoreo suma cinco tarjetas operativas que reutilizan el video, el detector, las alarmas y las capturas existentes. Todas se configuran desde la web y persisten en `localStorage`.

### Aforo por línea

El botón **Editar** de la tarjeta abre un editor para trazar una línea sobre el video. La línea tiene dos extremos arrastrables, presets **Horizontal** / **Vertical**, un botón **Invertir sentido**, nombre y capacidad. El aforo se calcula con el punto inferior-central de cada persona y una histéresis para evitar conteos dobles:

- Al cruzar la línea se suma un **ingreso** o una **salida**.
- El HUD muestra `IN`, `OUT` y `AFORO` (ocupación actual / capacidad).
- Cuando la ocupación llega a la capacidad se dispara la alarma de aforo y se guarda una captura automática.
- Los contadores son por sesión: se reinician al reconectar, recargar la página o usar **Reiniciar**.

La configuración se guarda en `autecVision.line.v1`. El botón **Probar** dispara el banner, la sirena y una captura de prueba sin esperar un cruce real.

### Gestión de colas

Se activa por zona desde el editor de zonas con la opción **Cola** y una espera máxima en segundos. La tarjeta muestra:

- Cantidad de personas actualmente en la cola.
- Espera promedio de las personas presentes.
- Estado de alerta cuando alguien supera la espera máxima o cuando la cola alcanza `maxPeople`.

Las alertas de cola usan el mismo banner, sonido y captura automática que las zonas restringidas. El evento guardado en el JSON de la captura es `queue`.

### Mapa de calor

Acumula la posición de los pies de cada persona en una grilla de 48 × 27 celdas y pinta las áreas de mayor circulación sobre el video con un canvas. Se activa o desactiva desde su tarjeta y se reinicia con **Reiniciar**. El mapa:

- Arranca desactivado para no alterar el video.
- No genera alertas.
- Vive en memoria: se reinicia al recargar la página.
- Se dibuja debajo de las zonas y las cajas, sin bloquear los controles.

### Puesto desatendido

Se activa por zona con la opción **Puesto desatendido** y un tiempo de ausencia en segundos. Si la zona queda sin personas durante ese tiempo, se dispara la alarma y se guarda una captura automática con el evento `unattended`. La tarjeta muestra los segundos sin cobertura y el estado `Cubierto` o `ALERTA`; el botón **Probar** permite verificar el aviso.

### Control de rondas

Se activa por zona con la opción **Control de rondas**. Cada checkpoint define un intervalo esperado (`patrol.intervalSeconds`, 15 minutos por defecto) y una tolerancia (`patrol.toleranceSeconds`, 5 minutos por defecto); en el editor se cargan en minutos. La tarjeta muestra la última visita, el próximo vencimiento y el estado:

- **Sin visitas:** todavía no se registró una visita desde que se habilitó el checkpoint.
- **Al día:** la última visita está dentro del intervalo.
- **Por vencer:** se cumplió el intervalo y corre la tolerancia.
- **Vencida:** se agotó la tolerancia. Dispara banner, sirena, aviso y captura automática con el evento `patrol`.

Cualquier persona que ingrese a la zona cuenta como visita: no se identifica al guardia ni se exige un recorrido completo. Una visita es la transición de 0 a 1 o más personas dentro de la zona, con la misma gracia de salida de 1.5 segundos que el resto de las skills, así que una persona quieta no suma visitas repetidas. La alerta se emite una sola vez por ciclo vencido y se limpia al registrar la próxima visita.

El estado de las rondas es de sesión: se reinicia al recargar la página, al conectar o desconectar la cámara y con el botón **Reiniciar** de la tarjeta. La configuración por zona se guarda dentro de `autecVision.zones.v1`. Si el checkpoint es de paso, conviene desactivar **Área restringida** para que la visita no dispare además una alarma de ingreso. El botón **Probar** permite verificar el aviso sin esperar a que venza el plazo.

## Variables de entorno

| Variable | Efecto |
|---|---|
| `AUTEC_DETECT=0` | Desactiva la IA. El video sigue funcionando. |
| `AUTEC_REID=0` | Desactiva la memoria de apariencia. Se usan los IDs directos de ByteTrack. |
| `AUTEC_REID_SECONDS=120` | Tiempo que se recuerda a una persona ausente. |
| `AUTEC_REID_THRESHOLD=0.66` | Similitud mínima para recuperar un ID. Bajarlo acepta más coincidencias, con más riesgo de confusión. |
| `AUTEC_THREADS=1` | Usa 1 hilo de inferencia. Útil si el video se entrecorta. |
| `AUTEC_THREADS=2` | Valor por defecto. |
| `AUTEC_EPP=0` | Desactiva la inferencia EPP. La interfaz sigue mostrando la regla, sin detección. |
| `AUTEC_EPP_MODEL=...` | Ruta alternativa al modelo EPP `.pt`. |
| `AUTEC_EPP_ONNX=...` | Ruta alternativa al modelo EPP `.onnx`. |
| `AUTEC_EPP_CONF=0.25` | Confianza mínima para casco y chaleco. |
| `AUTEC_EPP_IMGSZ=512` | Tamaño de entrada EPP (320–640). |
| `AUTEC_EPP_EVERY=2` | Ejecuta EPP cada N fotogramas (1–10). |
| `AUTEC_FALLS=0` | Desactiva la heurística de caídas en el backend. La interfaz sigue evaluando con las cajas si la skill está activa. |
| `AUTEC_FALLS_RATIO=1.05` | Umbral ancho/alto para marcar una caja como sospechosa (0.5–3.0). |
| `AUTEC_FALLS_GRACE=3` | Segundos que la caja debe permanecer horizontal antes de confirmar la caída. |
| `AUTEC_FALLS_COOLDOWN=120` | Enfriamiento entre avisos de la misma persona, en segundos. |
| `AUTEC_PORT=8080` | Cambia el puerto al ejecutar `server.py` directamente. `run.bat` usa `8000`. |

Ejemplo en PowerShell:

```powershell
$env:AUTEC_THREADS = "1"
.venv\Scripts\python.exe server.py
```

## API local

| Ruta | Descripción |
|---|---|
| `GET /api/health` | Estado del servicio y versión. |
| `GET /api/supabase/health` | Comprueba la conexión con Supabase. |
| `POST /api/auth/login` | Valida email y contraseña; devuelve el perfil y una cookie `HttpOnly`. |
| `POST /api/auth/logout` | Cierra la sesión y elimina la cookie. |
| `GET /api/auth/me` | Devuelve el perfil autenticado, o `{"ok": true, "authenticated": false, "profile": null}` sin sesión. |
| `GET /api/db/{tabla}` | Lectura pública de tablas de Supabase. |
| `POST /api/db/{tabla}` | Escritura protegida por sesión. |
| `PATCH /api/db/{tabla}` | Actualización protegida por sesión. |
| `DELETE /api/db/{tabla}` | Borrado protegido por sesión. |
| `GET /api/stream-health` | Estado del stream y fotogramas recibidos. |
| `GET /api/detections` | Último estado del detector y cajas. |
| `GET /api/captures` | Número y últimas capturas del dataset. |
| `POST /api/capture` | Guarda un JPEG con metadatos. Acepta `label`, `mode`, `zone`, `event` (`entry`, `dwell`, `count`, `queue`, `unattended`, `patrol`, `epp`, `mesa`, `fall`) y, según la skill, `profile`, `trackId`, `missing`, `table`, `fallSeconds` y `simulated`. |
| `POST /api/camera/lens` | Cambia el lente real en DroidCam OBS. Cuerpo JSON: `{host, port, lens}`. |
| `GET /stream` | Proxy MJPEG de DroidCam. |
| `GET /snapshot` | Descarga un fotograma JPEG. |
| `GET /api/discover` | Busca cámaras en la red local. |

Ejemplo de respuesta de `/api/detections`:

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
  "error": "",
  "model": "YOLO11n ONNX · COCO + ByteTrack + ReID"
}
```

`uniquePersons` cuenta IDs distintos vistos en la sesión. Con la memoria de apariencia, una reentrada no suma un ID nuevo. `reidMatches` indica cuántas veces se recuperó un número anterior.

El bloque `epp` del ejemplo corresponde al modelo real instalado. Sin modelo, el backend devuelve `enabled=false`, `available=false`, `reason="model-missing"` y `compliance=null`. Cada detección puede incluir su propio objeto `epp` con `helmet`, `vest`, `missing`, `status` (`ok`, `missing`, `partial`, `unknown`) y las sub-cajas normalizadas.

El bloque `falls` es siempre una heurística local disponible (salvo `AUTEC_FALLS=0`). Cada detección puede incluir `fall` con `status` (`normal`, `suspect`, `fallen`), `ratio`, `seconds` y `threshold`. El navegador usa ese estado como base y aplica la sensibilidad y la gracia configuradas por empresa.

Ejemplo de respuesta de `/api/camera/lens` con DroidCam OBS:

```json
{
  "ok": true,
  "lens": "front",
  "host": "192.168.1.40",
  "port": 4747,
  "supported": true,
  "changed": true,
  "cameras": ["Back Camera", "Front Camera"],
  "active": 1,
  "activeName": "Front Camera",
  "message": "Lente activo en el teléfono: Front Camera"
}
```

Con DroidCam clásico devuelve `supported: false` y un mensaje que indica usar Camera Swap en el teléfono.

## Capturas para el dataset

El botón **Guardar en dataset** guarda el fotograma actual en:

```text
D:\Autec\Proyectos\VigIA\data\captures
```

Cada captura genera:

- Un archivo `.jpg` con fecha y hora.
- Un archivo `.json` con metadatos: etiqueta, modo, IP, puerto, resolución, tamaño y fecha.
- En capturas de EPP, el JSON agrega `profile`, `trackId`, `missing`, `simulated` y un indicador `epp`.

La etiqueta es opcional y sirve para organizar las imágenes por escenario:

```text
entrada
laboratorio
pasillo
```

Estas capturas se usarán para anotar y entrenar el detector de EPP.

## Modo de prueba sin teléfono

El botón **Probar archivo** permite abrir una imagen o un video local en el visor. Sirve para:

- Probar la interfaz sin DroidCam.
- Preparar capturas y maquetas.
- Validar el diseño de las cajas de detección.

En este modo la barra de estado muestra **MODO PRUEBA**. El botón **Desconectar** cierra el archivo y vuelve al estado normal.

## Qué hace esta versión

- Muestra el video en vivo dentro de la web.
- Indica si está conectado, conectando, reconectando o con error.
- Se reconecta automáticamente si el stream se corta.
- Permite elegir la resolución del stream.
- Muestra resolución real, FPS aproximados, tiempo al primer frame y reconexiones.
- Busca la cámara en la red local si cambia la IP.
- Permite pantalla completa.
- Permite descargar una captura JPEG.
- Guarda capturas y metadatos en `data/captures`.
- Permite probar imágenes y videos locales sin el teléfono.
- Detecta personas con YOLO11n ONNX.
- Asigna un ID estable a cada persona con ByteTrack.
- Recuerda la apariencia de cada persona y le devuelve su número si vuelve a entrar dentro de 120 segundos.
- Dibuja cajas azules y etiquetas con ID y confianza.
- Muestra el contador de personas con ID activo.
- Informa del estado de la detección en el panel.
- Define zonas rectangulares con nombre, color y persistencia local.
- Trata las zonas como áreas restringidas y alerta al ingresar con el mensaje “Persona no autorizada ingresando a …”.
- Alerta por ingreso, merodeo y conteo por zona, con umbral configurable.
- Cuenta ingresos y salidas al cruzar una línea de aforo, con capacidad y sentido configurables.
- Mide colas por zona: cantidad de personas, espera promedio, espera máxima y alerta por límite o demora.
- Acumula un mapa de calor de circulación por posición de personas, sin generar alertas.
- Avisa cuando una zona configurada como puesto de trabajo queda sin personas durante el tiempo indicado.
- Controla rondas por checkpoint: última visita, próximo vencimiento, estado y alerta si no hay visita dentro del intervalo y la tolerancia.
- Evalúa EPP por persona (casco y chaleco) con perfiles por empresa: industrial, sitio industrial de cliente y sede corporativa.
- Permite a CIM alternar entre sitio industrial y sede corporativa sin recargar.
- Muestra el estado EPP en el monitoreo, el resumen y los ajustes, con métricas de cumplimiento y alertas por persona.
- Guarda evidencia de EPP con perfil, `trackId`, prendas faltantes y marca de simulación.
- Marca con `SIMULACIÓN` la demo cuando el modelo EPP real no está instalado.
- Estima ocupación de mesas y atención en salón con rectángulos configurables, sin identificar clientes.
- Alerta cuando una mesa supera el objetivo de atención y guarda una captura con el nombre de la mesa.
- Detecta posibles caídas con una heurística temporal ancho/alto de la caja de persona, sin modelo de pose.
- Permite ajustar sensibilidad, gracia y enfriamiento de caídas por empresa y muestra el estado en el monitoreo.
- Estima ocupación de barra, espera y capacidad con áreas rectangulares y alerta cuando se supera el objetivo.
- Cuenta puestos de trabajo ocupados y libres para estimar disponibilidad de escritorios.
- Controla el aforo de salas y aulas por área, con gracia y alerta de exceso.
- Avisa aglomeraciones en accesos, hall y salidas según el umbral configurado por punto.
- Emite una sirena, muestra un banner dentro del video y un aviso visible; el sonido se puede apagar.
- Guarda una captura automática con cada alerta: zona resaltada, cajas, texto y hora.
- Permite probar cada alerta con el botón **Probar**.
- Guarda varios perfiles de cámara y permite cambiar la cámara activa.
- Intenta cambiar el lente real en DroidCam OBS y explica el caso de DroidCam clásico.

## Qué no hace todavía

- No hay un modelo EPP entrenado ni un dataset EPP propio. La detección real de casco y chaleco queda pendiente de la fase de entrenamiento; la demo actual es una simulación marcada.
- EPP cubre casco y chaleco; guantes, gafas y protección auditiva quedan para una fase posterior.
- La detección EPP no identifica a la persona ni verifica que el casco esté bien colocado: solo asocia cajas y aplica la regla de la empresa.
- Mesas y clientes mide ocupación y permanencia por geometría; no identifica clientes, no lee comandas y no reemplaza al personal de salón.
- La detección de caídas usa solo la relación ancho/alto de la caja de persona, sin modelo de pose: puede fallar con personas sentadas, agachadas o cámaras muy inclinadas y no detecta caídas fuera del cuadro.
- Barra, puestos, salas, aulas y aglomeraciones usan geometría de la caja de persona: no distinguen clientes de personal, no miden distancia interpersonal y pueden contar de más si el detector duplica una caja.
- La espera de barra se estima desde la llegada del primer grupo, no desde la atención real de cada persona.
- Las zonas son rectangulares; no hay polígonos ni máscaras.
- El aforo por línea cuenta cruces de personas; no distingue dirección por rostro ni comparte contadores entre cámaras.
- Las colas se miden por permanencia dentro de una zona rectangular, no por la posición exacta en una fila.
- El control de rondas no identifica al guardia ni verifica un recorrido completo: cualquier persona que ingrese al checkpoint cuenta como visita. Se podrá combinar con ReID más adelante.
- El mapa de calor vive en memoria y todavía no se exporta como imagen ni se guarda entre sesiones.
- No graba video.
- No identifica personas ni usa reconocimiento facial. La memoria de apariencia solo compara color de ropa; no es biometría.
- No garantiza el mismo ID si la persona cambia de ropa, se gira, hay poca luz o pasan más de 120 segundos.
- No envía video a internet.
- El dashboard sigue siendo ilustrativo; el monitoreo y las alertas son reales.

Eso se agregará en las siguientes fases.

## Rendimiento

| Configuración | Resultado aproximado |
|---|---|
| ONNX 416, 2 hilos | 400–600 ms por inferencia (~2 FPS) |
| ONNX 416, 1 hilo | 600–1000 ms por inferencia |
| Equipo o navegador muy cargado | 1.1–2.5 s por inferencia |

Recomendaciones:

- Usa `640 × 480` para el stream si el equipo va justo.
- Cierra otras aplicaciones pesadas.
- Prueba `AUTEC_THREADS=1` si el video se entrecorta.
- No aumentes `imgsz` en `predict`: el modelo ONNX tiene entrada fija de 416 y el costo real no cambia.
- La detección se ejecuta en un hilo aparte para que el video no se bloquee.
- La memoria de apariencia añade solo unos milisegundos por persona: compara histogramas de color, no ejecuta otra red neuronal.

## Solución de problemas

### “No se pudo conectar”

- Verifica que DroidCam esté abierto en el teléfono.
- Confirma que el teléfono y la PC estén en la misma red.
- Revisa que la IP sea la correcta. Puede cambiar al reiniciar el hotspot.
- Comprueba el puerto, normalmente `4747`.
- Prueba abrir en el navegador del teléfono o de la PC:

```text
http://172.20.10.2:4747/video
```

Si esa URL no muestra el stream, el problema está en DroidCam o en la red, no en la web.

### “DroidCam está ocupado por otra conexión”

DroidCam solo permite una conexión de video a la vez. Si el cliente de DroidCam en Windows está conectado, la web no podrá tomar la cámara.

1. En el cliente de Windows, pulsa **Stop** o ciérralo completamente.
2. En el teléfono, verifica que DroidCam esté abierto y esperando conexión.
3. Vuelve a pulsar **Conectar** en VigIA.

### “Detección local: cargando modelo…”

Es normal la primera vez. La sesión ONNX tarda varios segundos en cargar. El video sigue funcionando mientras tanto. Si el mensaje no cambia después de 30 segundos, revisa la consola y que los modelos existan.

### “Detección local: desactivada”

La app se inició con `AUTEC_DETECT=0`. Cierra la consola, elimina esa variable de entorno y vuelve a arrancar:

```powershell
Remove-Item Env:AUTEC_DETECT
```

### “Detección local: error”

- Comprueba que `models/yolo11n.onnx` o `models/yolo11n.pt` existan.
- Revisa la consola: allí aparece el detalle del error.
- Si el error menciona `lap`, instala la dependencia:

```powershell
.venv\Scripts\python.exe -m pip install lap
```

### La IA va lenta o el video se entrecorta

- Usa `640 × 480`.
- Cierra el navegador con muchas pestañas y otras aplicaciones pesadas.
- Prueba `AUTEC_THREADS=1`.
- Ten en cuenta que este equipo tiene 2 núcleos lógicos; ~2 FPS es el rendimiento esperado.

### La misma persona recibe otro ID al volver a entrar

ByteTrack no reconoce personas: mantiene un ID mientras el rastro está activo. Cuando la persona sale del plano, el rastro se pierde y al volver se crea uno nuevo. La memoria de apariencia de esta versión intenta devolverle el número anterior durante **120 segundos**.

Si aun así cambia de número:

- Puede haber pasado más de `AUTEC_REID_SECONDS`. Súbelo, por ejemplo:

```powershell
$env:AUTEC_REID_SECONDS = "300"
```

- La persona cambió mucho de ropa, se giró o la iluminación cambió de forma brusca. La comparación de color deja de ser fiable.
- Hay otra persona con ropa muy parecida. En ese caso la app prefiere un ID nuevo antes que confundirlas.
- La persona vuelve a entrar por una zona muy distinta y con otra escala. La memoria compara apariencia, no posición.
- Los IDs se reinician al desconectar y volver a conectar la cámara.

Para aceptar coincidencias más débiles (con más riesgo de confusión):

```powershell
$env:AUTEC_REID_THRESHOLD = "0.60"
```

Para desactivar la memoria y volver a los IDs directos de ByteTrack:

```powershell
$env:AUTEC_REID = "0"
```

### El contador baja y sube

El contador usa IDs activos con una tolerancia de 1.5 segundos. Si una persona sale del encuadre, su ID desaparece después de ese tiempo. Si el problema es constante, revisa la iluminación y la distancia: las personas muy lejanas o pequeñas pueden no detectarse.

### “No se encontró una cámara en la red local”

La búsqueda revisa la red de la PC y busca el puerto `4747`.

- Verifica que el teléfono esté despierto y con DroidCam abierto.
- Confirma que el teléfono y la PC estén en la misma red o hotspot.
- Si la PC usa varias interfaces (WiFi, Ethernet, VPN), la búsqueda puede estar revisando la red equivocada. Escribe la IP manualmente.
- La búsqueda solo revisa la red `/24` de la interfaz principal.

### “DroidCam respondió con una página web, no con un stream”

Eso significa que la web llegó al servidor de DroidCam, pero la ruta usada devolvió HTML.

- Abre `http://IP:4747/` en el navegador. Ahí DroidCam muestra su interfaz y la URL exacta del stream.
- Cierra el cliente de DroidCam en Windows y vuelve a intentar. DroidCam suele permitir una sola conexión.
- La web intenta primero `/video/{resolución}` y `/mjpegfeed`, que respetan el lente activo en el teléfono. Si DroidCam responde `DroidCam is Busy`, hay que cerrar el cliente de Windows. `/video/force/{resolución}` queda como último recurso porque puede liberar la cámara pero también forzar otra fuente.
- Si la interfaz de DroidCam muestra otra ruta, agrégala a `CAMERA_PATHS` en `server.py`.

### “No se pudo reconectar después de 12 intentos”

La app dejó de reintentar para no dejar la cámara ocupada.

1. Verifica que DroidCam siga abierto en el teléfono.
2. Cierra el cliente de DroidCam en Windows si está conectado.
3. Pulsa **Reconectar**.
4. Si la IP cambió, pulsa **Buscar**.

### El video se congela

Pulsa **Reconectar**. Si ocurre seguido, revisa la señal WiFi y que el teléfono no esté en ahorro de energía. También puedes probar `640 × 480` y `AUTEC_THREADS=1`.

## Privacidad y alcance

VigIA procesa el video en el equipo: el servidor escucha solo en `127.0.0.1` y las imágenes no se envían a internet. Los datos operativos (empresas, eventos, métricas y evidencia) se guardan en Supabase. La memoria de apariencia vive solo en RAM y se borra al desconectar la cámara; no se guardan rostros ni plantillas biométricas. No se debe usar para vigilancia individual ni para sanciones automáticas.

## Siguiente fase

La versión 0.5.0 ya incluye la Fase 1: Supabase como única fuente de verdad, auth simple persistida con cookies `HttpOnly`, limpieza de datos de demostración y CI con Python y Node. La detección local, zonas, alertas, EPP, mesas, caídas y ocupación por áreas siguen disponibles sobre esa base. El siguiente paso recomendado es:

1. Migrar la interfaz a Next.js para separar claramente frontend y backend.
2. Integrar cámaras IP reales (RTSP/HTTP), conservando DroidCam como cliente legacy.
3. Endurecer RLS y permisos por empresa en Supabase.
4. Entrenar y validar el modelo EPP de casco y chaleco con capturas reales y métricas reproducibles (`models/epp/README.md`).
5. Reemplazar la heurística de caídas por un modelo de pose y validarla con videos etiquetados.
6. Validar mesas y ocupación por áreas con layouts reales y medir el error de conteo.
7. Exportar el mapa de calor como imagen y conservarlo entre sesiones.
8. Publicar en Vercel cuando la migración a Next.js esté lista. Pagos y Clerk quedan fuera de este plan.
