# Modelo EPP — casco y chaleco

Esta carpeta documenta el modelo opcional de **Equipo de Protección Personal** que usa
VigIA para evaluar casco y chaleco por persona.

> **Estado actual:** no hay modelo EPP entrenado ni dataset EPP en el repositorio.
> `models/` solo contiene `yolo11n.onnx` y `yolo11n.pt`. Mientras falten
> `models/epp_yolo11n.onnx` o `models/epp_yolo11n.pt`, el backend publica
> `epp.enabled=false` y `reason="model-missing"`, y la maqueta usa una
> **simulación marcada** con badges `SIMULACIÓN`. Esa simulación sirve para
> validar la interfaz y la demo, no para medir cumplimiento real.

## Archivos esperados

```text
models/
├── epp_yolo11n.onnx   ← preferido (más rápido en CPU)
└── epp_yolo11n.pt     ← respaldo PyTorch
```

Rutas alternativas:

```powershell
$env:AUTEC_EPP_ONNX = "D:\ruta\epp_yolo11n.onnx"
$env:AUTEC_EPP_MODEL = "D:\ruta\epp_yolo11n.pt"
```

## Clases recomendadas

El detector acepta variantes de nombres, pero el entrenamiento recomendado usa:

| ID | Clase | Uso |
|---|---|---|
| 0 | `person` | Permite validar la asociación dentro del mismo modelo |
| 1 | `helmet` | Casco |
| 2 | `vest` | Chaleco |

Opcionalmente se pueden agregar clases negativas `no_helmet` y `no_vest` si el
dataset las etiqueta de forma consistente. El backend también entiende alias como
`hardhat`, `safety_helmet`, `safety_vest`, `reflective_vest`, `casco`, `chaleco`,
`sin_casco` y `sin_chaleco`.

El modelo puede omitir `person`: la asociación se hace contra las cajas de persona
que ya entrega YOLO11n COCO. La clase `person` en el modelo EPP es útil para
verificar el dataset, pero no es obligatoria.

## Dataset

Estructura sugerida (formato YOLO detection):

```text
dataset/
├── data.yaml
├── images/
│   ├── train/
│   ├── val/
│   └── test/
└── labels/
    ├── train/
    ├── val/
    └── test/
```

`data.yaml`:

```yaml
path: D:/Autec/Proyectos/VigIA/dataset
train: images/train
val: images/val
test: images/test
names:
  0: person
  1: helmet
  2: vest
```

Recomendaciones:

- Capturar con la misma cámara, altura, distancia y luz del sitio real.
- Incluir personas de frente, de espaldas, agachadas, parcialmente ocluidas y en grupos.
- Incluir casco de distintos colores, chaleco reflectivo y ropa de civil sin EPP.
- Etiquetar el casco aunque la persona esté lejos; evitar cajas que cubran la cara.
- Separar por **escena/día**, no por imagen, para que no haya fuga entre splits.
- Mínimo sugerido para el piloto: 1.500 imágenes y 2.500 instancias EPP.
- Guardar las capturas crudas con el botón **Guardar en dataset** de la app.

## Entrenamiento

Con Ultralytics instalado en `.venv`:

```powershell
.venv\Scripts\python.exe -c "from ultralytics import YOLO; YOLO('yolo11n.pt').train(data='dataset/data.yaml', epochs=100, imgsz=640, batch=8, device='cpu', project='runs/epp', name='yolo11n')"
```

En CPU el entrenamiento es lento. Si hay GPU disponible, usar `device=0`.

## Exportación a ONNX

```powershell
.venv\Scripts\python.exe -c "from ultralytics import YOLO; YOLO('runs/epp/yolo11n/weights/best.pt').export(format='onnx', imgsz=512, opset=12, simplify=True)"
```

Copiar el archivo exportado a:

```text
models/epp_yolo11n.onnx
```

## Variables del backend

| Variable | Valor por defecto | Efecto |
|---|---|---|
| `AUTEC_EPP` | `1` | Activa o desactiva la inferencia EPP. |
| `AUTEC_EPP_ONNX` | `models/epp_yolo11n.onnx` | Ruta del modelo ONNX. |
| `AUTEC_EPP_MODEL` | `models/epp_yolo11n.pt` | Ruta del modelo PyTorch de respaldo. |
| `AUTEC_EPP_CONF` | `0.25` | Confianza mínima. |
| `AUTEC_EPP_IMGSZ` | `512` | Entrada entre 320 y 640. |
| `AUTEC_EPP_EVERY` | `2` | Infiere cada N fotogramas (1–10). |

## Métricas a documentar

Guardar el reporte en `models/epp/metrics.json` y completar esta tabla:

| Métrica | Meta sugerida | Resultado real |
|---|---|---|
| mAP@0.5 `helmet` | ≥ 0,75 | pendiente |
| mAP@0.5 `vest` | ≥ 0,75 | pendiente |
| mAP@0.5 `person` | ≥ 0,80 | pendiente |
| Accuracy de cumplimiento por persona | ≥ 85 % | pendiente |
| Falsos positivos | ≤ 1 alerta / 10 min | pendiente |
| FPS con EPP activo | ≥ 1 FPS | pendiente |
| Latencia EPP | ≤ 800 ms | pendiente |

`metrics.json` sugerido:

```json
{
  "model": "epp_yolo11n.onnx",
  "dataset": "epp-v1",
  "date": "2026-11-16",
  "classes": ["person", "helmet", "vest"],
  "map50": { "person": null, "helmet": null, "vest": null },
  "map50_95": { "person": null, "helmet": null, "vest": null },
  "precision": { "helmet": null, "vest": null },
  "recall": { "helmet": null, "vest": null },
  "complianceAccuracy": null,
  "fps": null,
  "latencyMs": null,
  "notes": "Completar después del entrenamiento y la validación en campo."
}
```

## Limitaciones conocidas

- Un casco en la mano o apoyado no es lo mismo que un casco puesto; el modelo puede confundirlos.
- La asociación usa la posición del centro dentro de la caja de la persona; personas muy juntas pueden intercambiar prendas.
- El chaleco oscuro o poco reflectivo se detecta peor con poca luz.
- La oclusión parcial del torso puede producir falsos negativos.
- El suavizado temporal agrega unos segundos de retardo antes de alertar; es intencional para evitar parpadeos.
- La regla de la empresa se aplica en el frontend. El backend informa lo que ve, no sanciona.
- No hay reconocimiento facial ni identificación biométrica.

## Verificación rápida

```powershell
python -m unittest tests.test_epp -v
python -m py_compile detector.py server.py
```

Con el modelo instalado, abrir `/api/detections` y comprobar que `epp.available`
sea `true` y que `epp.model` nombre el archivo cargado. Sin modelo debe devolver
`available=false` y `reason="model-missing"`.
