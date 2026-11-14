# Taxonomía Anatómica - Body Map (AWAKIN OS)

Guía completa de referencia técnica para las regiones musculares y articulares mapeadas en el componente `BodyMapComponent` (`awakin-fe/src/app/features/workout/components/body-map`).

---

## 1. Modelo Muscular Avanzado (`advanced`)

Disponible para ambos sexos (`male` y `female`). Proporciona una segmentación muscular profunda para análisis de hipertrofia, fatiga y activación específica.

### Vista Frontal (Anterior)

| ID SVG / Código | Nombre en Español | Zona Anatómica |
| :--- | :--- | :--- |
| `neck` | Cuello | Región cervical anterior |
| `upper-trapezius` | Trapecio superior | Cuello lateral y hombros superiores |
| `anterior-deltoid` | Deltoides anterior | Porción frontal del hombro |
| `lateral-deltoid` | Deltoides lateral | Porción medial / lateral del hombro |
| `upper-pectoralis` | Pectoral superior | Cabeza clavicular del pectoral mayor |
| `mid-lower-pectoralis` | Pectoral medio e inferior | Cabeza esternocostal del pectoral mayor |
| `long-head-bicep` | Bíceps (cabeza larga) | Brazo anterior lateral |
| `short-head-bicep` | Bíceps (cabeza corta) | Brazo anterior medial |
| `wrist-flexors` | Flexores de muñeca | Antebrazo anterior / cara interna |
| `wrist-extensors` | Extensores de muñeca | Antebrazo posterior / lateral |
| `hands` | Manos | Extremidad distal superior |
| `upper-abdominals` | Abdominales superiores | Porción superior del recto abdominal |
| `lower-abdominals` | Abdominales inferiores | Porción inferior del recto abdominal |
| `obliques` | Oblicuos | Pared abdominal anterolateral |
| `groin` | Ingle | Región ilioinguinal / Pectíneo |
| `inner-thigh` | Aductores / Muslo interno | Aductor mayor, mediano y grácil |
| `rectus-femoris` | Recto femoral | Porción central anterior del cuádriceps |
| `outer-quadricep` | Cuádriceps lateral | Vasto lateral |
| `inner-quadricep` | Cuádriceps medial | Vasto medial ("lágrima") |
| `tibialis` | Tibial anterior | Espinilla / Cara anterolateral de la pierna |
| `soleus` | Sóleo | Músculo sóleo profundo |
| `gastrocnemius` | Gastrocnemio | Gemelos (visibles en vista frontal) |
| `feet` | Pies | Dorso del pie |

### Vista Posterior (Dorsal)

| ID SVG / Código | Nombre en Español | Zona Anatómica |
| :--- | :--- | :--- |
| `neck` | Cuello posterior | Región nucal |
| `upper-trapezius` | Trapecio superior | Espalda alta y base del cuello |
| `traps-middle` | Trapecio medio | Región interescapular |
| `lower-trapezius` | Trapecio inferior | Espalda alta / Porción torácica inferior |
| `posterior-deltoid` | Deltoides posterior | Cara posterior del hombro |
| `lateral-deltoid` | Deltoides lateral | Cara lateral del hombro |
| `long-head-triceps` | Tríceps (cabeza larga) | Brazo posterior medial |
| `lateral-head-triceps` | Tríceps (cabeza lateral) | Brazo posterior lateral |
| `medial-head-triceps` | Tríceps (cabeza medial) | Brazo posterior inferior |
| `wrist-extensors` | Extensores de muñeca | Antebrazo posterior |
| `wrist-flexors` | Flexores de muñeca | Antebrazo |
| `hands` | Manos | Extremidad superior posterior |
| `lats` | Dorsal ancho (*Latissimus dorsi*) | Espalda media y dorsolateral |
| `lowerback` | Zona lumbar | Erectores de la columna / Cuadrado lumbar |
| `gluteus-medius` | Glúteo medio | Región lateral de la cadera |
| `gluteus-maximus` | Glúteo mayor | Región glútea principal |
| `inner-thigh` | Aductores | Muslo medial posterior |
| `lateral-hamstrings` | Isquiotibiales laterales | Bíceps femoral |
| `medial-hamstrings` | Isquiotibiales mediales | Semitendinoso y Semimembranoso |
| `gastrocnemius` | Gastrocnemio (Gemelos) | Gemelo interno y externo |
| `soleus` | Sóleo | Pantorrilla inferior posterior |
| `feet` | Pies | Talón y planta del pie |

---

## 2. Modelo Muscular Básico / Estándar (`standard`)

Segmentación simplificada por grupos musculares mayores, ideal para vistas generales, registro rápido y rutinas compactas:

### Vista Frontal (Anterior)

| ID SVG / Código | Nombre en Español | Grupo Cubierto |
| :--- | :--- | :--- |
| `traps` | Trapecios | Trapecios superiores |
| `front-shoulders` | Hombros anteriores | Deltoides anterior y lateral |
| `chest` | Pectorales | Pectoral mayor |
| `biceps` | Bíceps | Bíceps braquial y braquial |
| `forearms` | Antebrazos | Musculatura del antebrazo |
| `hands` | Manos | Manos |
| `abdominals` | Abdominales | Recto abdominal completo |
| `obliques` | Oblicuos | Pared lateral abdominal |
| `quads` | Cuádriceps | Cuádriceps femoral completo |
| `calves` | Pantorrillas | Gemelos y sóleo |

### Vista Posterior (Dorsal)

| ID SVG / Código | Nombre en Español | Grupo Cubierto |
| :--- | :--- | :--- |
| `traps` | Trapecios | Trapecio superior e inferior |
| `traps-middle` | Trapecio medio | Trapecio medio interescapular |
| `rear-shoulders` | Hombros posteriores | Deltoides posterior |
| `triceps` | Tríceps | Tríceps braquial completo |
| `forearms` | Antebrazos | Antebrazos posteriores |
| `hands` | Manos | Manos posteriores |
| `lats` | Dorsales | Dorsal ancho completo |
| `lowerback` | Zona lumbar | Espalda baja |
| `glutes` | Glúteos | Glúteos mayores y medios |
| `hamstrings` | Isquiotibiales | Femorales posteriores completos |
| `calves` | Pantorrillas | Pantorrillas posteriores |

---

## 3. Articulaciones (`joints`)

Overlay interactivo de puntos articulares para monitoreo de dolor articular, movilidad, lesiones o rango de movimiento:

### Vista Frontal (Anterior)

| ID SVG / Código | Articulación | Región Anatómica |
| :--- | :--- | :--- |
| `shoulders` | Hombro | Articulación glenohumeral |
| `elbow` | Codo | Articulación humeroradial / humerocubital |
| `wrist` | Muñeca | Articulación radiocarpiana |
| `hips` | Cadera | Articulación coxofemoral |
| `knees` | Rodilla | Articulación femorotibial / femororrotuliana |
| `ankles` | Tobillo | Articulación talocrural |

### Vista Posterior (Dorsal)

| ID SVG / Código | Articulación | Región Anatómica |
| :--- | :--- | :--- |
| `upper-spine` | Columna cervical y torácica | Segmento vertebral C1 - T12 |
| `scapula` | Escápula | Articulación escapulotorácica |
| `lower-spine` | Columna lumbar | Segmento vertebral L1 - L5 / Sacro |
| `shoulders` | Hombro posterior | Glenohumeral posterior |
| `elbow` | Codo posterior | Olécranon |
| `wrist` | Muñeca posterior | Radiocarpiana posterior |
| `knees` | Rodilla posterior | Fosa poplítea |
| `ankles` | Tobillo posterior | Región aquilea y talocrural posterior |

---

## 4. Consistencia Anatómica (Hombre / Mujer)

* **Interoperabilidad Total**: Ambos modelos (`male` y `female`) comparten de manera idéntica todos los identificadores (`data-muscle-id`).
* **Diferenciación Visual**: La variación reside exclusivamente en la silueta y proporciones vectoriales del SVG (cintura, amplitud clavicular, silueta de cadera y volumen de glúteos/muslos), manteniendo la misma API programática.

