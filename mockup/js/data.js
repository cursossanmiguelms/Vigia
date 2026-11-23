(function () {
  window.AUTEC = window.AUTEC || {};

  var creator = {
    id: 'u-creator',
    name: 'Administrador',
    email: 'admin@vigia.local',
    role: 'creator'
  };

  var companies = [
    {
      id: 'cim', name: 'CIM Seguridad', short: 'CIM', sector: 'Seguridad privada', status: 'active',
      planId: 'pro', seats: 15, usersCount: 8, expiresAt: '2026-12-12', createdAt: '2026-03-12',
      contact: 'María Fernández', email: 'maria@cim.com', phone: '+54 11 5555-0101',
      skills: ['personas', 'reid', 'zonas', 'merodeo', 'aforo', 'colas', 'mapa-calor', 'puesto-desatendido', 'rondas', 'epp', 'aglomeraciones'], lastActivity: 'Hace 2 min', mrr: 199, color: '#F5A524', domain: 'cim.com'
    },
    {
      id: 'logistica-norte', name: 'Logística Norte', short: 'LN', sector: 'Logística', status: 'active',
      planId: 'basic', seats: 5, usersCount: 4, expiresAt: '2026-11-30', createdAt: '2026-06-20',
      contact: 'Martín Paz', email: 'martin@logisticanorte.com', phone: '+54 11 5555-0202',
      skills: ['personas'], lastActivity: 'Hace 18 min', mrr: 79, color: '#22D3EE', domain: 'logisticanorte.com'
    },
    {
      id: 'retail-centro', name: 'Retail Centro', short: 'RC', sector: 'Retail', status: 'trial',
      planId: 'demo', seats: 3, usersCount: 3, expiresAt: '2026-11-18', createdAt: '2026-11-04',
      contact: 'Camila Silva', email: 'camila@retailcentro.com', phone: '+54 11 5555-0303',
      skills: ['personas', 'reid', 'zonas', 'merodeo', 'colas', 'mesas', 'aglomeraciones'], lastActivity: 'Hace 1 h', mrr: 0, color: '#34D399', domain: 'retailcentro.com'
    },
    {
      id: 'planta-sur', name: 'Planta Sur', short: 'PS', sector: 'Industria', status: 'active',
      planId: 'pro', seats: 15, usersCount: 12, expiresAt: '2027-01-15', createdAt: '2025-11-15',
      contact: 'Lucía Ortega', email: 'lucia@plantasur.com', phone: '+54 11 5555-0404',
      skills: ['personas', 'reid', 'zonas', 'merodeo', 'epp', 'puestos-libres'], lastActivity: 'Hace 5 min', mrr: 199, color: '#60A5FA', domain: 'plantasur.com'
    },
    {
      id: 'hotel-alba', name: 'Hotel Alba', short: 'HA', sector: 'Hostelería', status: 'expired',
      planId: 'basic', seats: 5, usersCount: 5, expiresAt: '2026-11-01', createdAt: '2025-10-01',
      contact: 'Valentina Ríos', email: 'valentina@hotelalba.com', phone: '+54 11 5555-0505',
      skills: ['personas', 'mesas', 'barra', 'aforo-salas'], lastActivity: 'Hace 8 días', mrr: 0, color: '#FB7185', domain: 'hotelalba.com'
    },
    {
      id: 'constructora-andes', name: 'Constructora Andes', short: 'CA', sector: 'Construcción', status: 'active',
      planId: 'corporate', seats: 30, usersCount: 24, expiresAt: '2027-03-01', createdAt: '2025-03-01',
      contact: 'Federico Castro', email: 'federico@constructoraandes.com', phone: '+54 11 5555-0606',
      skills: ['personas', 'reid', 'zonas', 'merodeo', 'aforo-aulas'], lastActivity: 'Hace 12 min', mrr: 499, color: '#FBBF24', domain: 'constructoraandes.com'
    },
    {
      id: 'clinica-valle', name: 'Clínica del Valle', short: 'CV', sector: 'Salud', status: 'active',
      planId: 'basic', seats: 5, usersCount: 5, expiresAt: '2026-12-20', createdAt: '2026-05-10',
      contact: 'Rocío Luna', email: 'rocio@clinicavalle.com', phone: '+54 11 5555-0707',
      skills: ['personas', 'caidas', 'aforo-salas'], lastActivity: 'Hace 25 min', mrr: 79, color: '#F97316', domain: 'clinicavalle.com'
    },
    {
      id: 'puerto-nuevo', name: 'Puerto Nuevo', short: 'PN', sector: 'Logística', status: 'suspended',
      planId: 'pro', seats: 15, usersCount: 9, expiresAt: '2026-10-15', createdAt: '2025-09-01',
      contact: 'Gonzalo Herrera', email: 'gonzalo@puertonuevo.com', phone: '+54 11 5555-0808',
      skills: ['personas', 'reid'], lastActivity: 'Hace 15 días', mrr: 0, color: '#94A3B8', domain: 'puertonuevo.com'
    }
  ];

  var plans = [
    {
      id: 'demo', name: 'Demo', price: 0, period: '14 días', billing: 'sin costo', seats: 3,
      durationDays: 14, skills: ['personas', 'reid', 'zonas', 'merodeo', 'aforo', 'colas', 'mapa-calor', 'puesto-desatendido', 'rondas', 'mesas', 'barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones'], color: '#8B929B',
      description: 'Prueba controlada para validar el flujo completo.'
    },
    {
      id: 'basic', name: 'Básico', price: 79, period: 'mes', billing: 'mensual', seats: 5,
      durationDays: 30, skills: ['personas', 'caidas', 'barra', 'aforo-salas'], color: '#22D3EE',
      description: 'Para equipos pequeños con una cámara y un puesto de monitoreo.'
    },
    {
      id: 'pro', name: 'Profesional', price: 199, period: 'mes', billing: 'mensual', seats: 15,
      durationDays: 30, skills: ['personas', 'reid', 'zonas', 'merodeo', 'aforo', 'colas', 'mapa-calor', 'puesto-desatendido', 'rondas', 'epp', 'mesas', 'caidas', 'barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones'], color: '#F5A524',
      description: 'Para operaciones con varios puestos, turnos, reidentificación, EPP, salón, aforos y caídas.'
    },
    {
      id: 'corporate', name: 'Corporativo', price: 499, period: 'mes', billing: 'anual', seats: 30,
      durationDays: 365, skills: ['personas', 'reid', 'zonas', 'merodeo', 'aforo', 'colas', 'mapa-calor', 'puesto-desatendido', 'rondas', 'epp', 'mesas', 'caidas', 'barra', 'puestos-libres', 'aforo-salas', 'aforo-aulas', 'aglomeraciones'], color: '#34D399',
      description: 'Multi-sede, más usuarios, EPP, salón, aforos, caídas y soporte prioritario.'
    }
  ];

  var industries = [
    {
      id: 'seguridad', name: 'Seguridad privada', short: 'Seguridad', icon: 'shield-check', status: 'available',
      description: 'Vigilancia de sedes, perímetros, accesos y EPP en sitios industriales.'
    },
    {
      id: 'retail', name: 'Retail', short: 'Retail', icon: 'tag', status: 'available',
      description: 'Conteo, colas y comportamiento en tienda.'
    },
    {
      id: 'industria', name: 'Industria', short: 'Industria', icon: 'building', status: 'available',
      description: 'Seguridad laboral, EPP y control de procesos.'
    },
    {
      id: 'logistica', name: 'Logística', short: 'Logística', icon: 'package', status: 'available',
      description: 'Patios, andenes y trazabilidad de vehículos.'
    },
    {
      id: 'hosteleria', name: 'Hostelería', short: 'Hostelería', icon: 'utensils', status: 'available',
      description: 'Salones, barras y tiempos de servicio.'
    },
    {
      id: 'salud', name: 'Salud', short: 'Salud', icon: 'activity', status: 'available',
      description: 'Caídas, espera y ocupación de espacios.'
    },
    {
      id: 'construccion', name: 'Construcción', short: 'Construcción', icon: 'hard-hat', status: 'available',
      description: 'EPP, trabajo en altura y zonas de riesgo.'
    },
    {
      id: 'oficinas', name: 'Oficinas', short: 'Oficinas', icon: 'briefcase', status: 'soon',
      description: 'Aforo, puestos y acceso de visitantes.'
    },
    {
      id: 'educacion', name: 'Educación', short: 'Educación', icon: 'book-open', status: 'soon',
      description: 'Aulas, patios y rutas de evacuación.'
    },
    {
      id: 'transporte', name: 'Transporte', short: 'Transporte', icon: 'car', status: 'soon',
      description: 'Unidades, cabinas y terminales.'
    },
    {
      id: 'agro', name: 'Agro', short: 'Agro', icon: 'leaf', status: 'soon',
      description: 'Campo, animales y maquinaria.'
    },
    {
      id: 'energia', name: 'Energía y data centers', short: 'Energía / DC', icon: 'server', status: 'soon',
      description: 'Salas críticas, data centers e infraestructura.'
    },
    {
      id: 'banca', name: 'Banca', short: 'Banca', icon: 'money', status: 'soon',
      description: 'Sucursales, cajeros y afluencia.'
    }
  ];

  var skillGroups = [
    {
      id: 'base', name: 'Transversales', short: 'Base', icon: 'layers', status: 'available',
      description: 'Capacidades que se combinan con cualquier industria y cualquier cámara.'
    },
    {
      id: 'drones', name: 'Drones', short: 'Drones', icon: 'drone', status: 'training',
      description: 'El software opera sobre la cámara de un dron: patrullaje, conteo aéreo, EPP e inspección.'
    }
  ].concat(industries);

  function makeSkill(id, name, short, status, group, description, industriesList, icon, progress, companiesUsing, featured, pilot) {
    return {
      id: id, name: name, short: short, status: status, group: group,
      description: description, industries: industriesList, icon: icon,
      progress: status === 'available' ? 100 : (progress || 0),
      globalActive: status === 'available',
      companiesUsing: companiesUsing || 0,
      featured: Boolean(featured),
      pilot: Boolean(pilot)
    };
  }

  var skills = [
    makeSkill('personas', 'Detección de personas', 'Personas', 'available', 'base',
      'Detecta y cuenta personas en tiempo real, con cajas y confianza por detección.',
      ['Seguridad privada', 'Industria', 'Retail', 'Logística'], 'users', 100, 8, true),
    makeSkill('reid', 'Reidentificación', 'ReID', 'available', 'base',
      'Mantiene el ID de una persona cuando sale y vuelve a entrar en cámara.',
      ['Seguridad privada', 'Retail', 'Industria'], 'scan', 100, 5, true),
    makeSkill('zonas', 'Zonas restringidas', 'Zonas', 'available', 'base',
      'Define áreas y detecta ingresos no autorizados.',
      ['Seguridad privada', 'Industria', 'Energía y data centers'], 'map', 100, 4, true),
    makeSkill('merodeo', 'Merodeo', 'Merodeo', 'available', 'base',
      'Detecta permanencia prolongada en zonas sensibles.',
      ['Seguridad privada', 'Retail', 'Banca'], 'eye', 100, 4, true),
    makeSkill('aforo', 'Aforo y conteo por línea', 'Aforo', 'available', 'base',
      'Cuenta entradas y salidas al cruzar una línea y alerta cuando se supera la capacidad.',
      ['Retail', 'Seguridad privada', 'Hostelería', 'Industria'], 'activity', 100, 1, true),
    makeSkill('colas', 'Gestión de colas', 'Colas', 'available', 'base',
      'Mide la cantidad de personas en fila y el tiempo de espera dentro de una zona.',
      ['Retail', 'Hostelería', 'Banca'], 'list', 100, 1, true),
    makeSkill('mapa-calor', 'Mapa de calor', 'Mapa de calor', 'available', 'base',
      'Acumula la posición de las personas y pinta las áreas de mayor circulación.',
      ['Retail', 'Hostelería', 'Industria'], 'chart', 100, 1, true),
    makeSkill('puesto-desatendido', 'Puesto desatendido', 'Puesto', 'available', 'base',
      'Avisa cuando una zona de trabajo queda sin personas durante el tiempo configurado.',
      ['Seguridad privada', 'Industria', 'Logística'], 'clock', 100, 1, true),
    makeSkill('rondas', 'Control de rondas', 'Rondas', 'available', 'base',
      'Verifica que los checkpoints se visiten dentro del intervalo y la tolerancia configurados.',
      ['Seguridad privada', 'Industria', 'Logística', 'Energía y data centers'], 'shield-check', 100, 1, true),

    makeSkill('epp', 'EPP / Indumentaria', 'EPP', 'available', 'industria',
      'Detecta casco y chaleco por persona. Piloto con simulación marcada hasta instalar el modelo entrenado.',
      ['Industria', 'Seguridad privada', 'Construcción', 'Agro'], 'hard-hat', 100, 2, true, true),
    makeSkill('humo-fuego', 'Humo y fuego', 'Humo / fuego', 'soon', 'industria',
      'Detecta columnas de humo o fuego incipiente en plantas, depósitos y patios.',
      ['Industria', 'Energía y data centers', 'Logística'], 'alert', 0, 0, false),
    makeSkill('derrames', 'Derrames y obstrucciones', 'Derrames', 'soon', 'industria',
      'Reconoce líquidos derramados, objetos caídos y pasillos bloqueados.',
      ['Industria', 'Logística', 'Construcción'], 'droplets', 0, 0, false),

    makeSkill('control-accesos', 'Control de accesos', 'Accesos', 'soon', 'seguridad',
      'Verifica ingresos por puerta, horarios y permanencia de visitantes.',
      ['Seguridad privada', 'Oficinas', 'Banca', 'Educación'], 'key', 0, 0, false),
    makeSkill('intrusos-perimetro', 'Intrusión perimetral', 'Perímetro', 'soon', 'seguridad',
      'Detecta cruces de perímetro y presencia no autorizada en horarios sensibles.',
      ['Seguridad privada', 'Industria', 'Energía y data centers', 'Agro'], 'shield-check', 0, 0, false),
    makeSkill('aglomeraciones', 'Aglomeraciones', 'Aglomeración', 'available', 'seguridad',
      'Avisa cuando se concentra demasiada gente en un punto o una salida. Piloto con simulación marcada sin cámara.',
      ['Seguridad privada', 'Retail', 'Transporte', 'Educación'], 'users', 100, 2, false, true),
    makeSkill('objetos-abandonados', 'Objetos abandonados', 'Objetos', 'soon', 'seguridad',
      'Detecta bultos o paquetes que quedan solos durante el tiempo configurado.',
      ['Seguridad privada', 'Transporte', 'Banca'], 'package', 0, 0, false),

    makeSkill('gondolas-vacias', 'Góndolas vacías', 'Góndolas', 'soon', 'retail',
      'Marca espacios vacíos en góndolas para reposición y control de stock visual.',
      ['Retail'], 'list', 0, 0, false),
    makeSkill('cajas-tiempo', 'Tiempo en caja', 'Cajas', 'soon', 'retail',
      'Mide espera y atención por caja para equilibrar turnos en horas pico.',
      ['Retail', 'Banca'], 'clock', 0, 0, false),
    makeSkill('uniforme-personal', 'Uniforme del personal', 'Uniforme', 'soon', 'retail',
      'Verifica que el personal de salón use el uniforme definido por la marca.',
      ['Retail', 'Hostelería'], 'users', 0, 0, false),

    makeSkill('patentes', 'Lectura de patentes', 'Patentes', 'training', 'logistica',
      'Lee matrículas de vehículos en accesos y playas de estacionamiento.',
      ['Logística', 'Transporte'], 'car', 48, 0, false),
    makeSkill('andenes', 'Ocupación de andenes', 'Andenes', 'soon', 'logistica',
      'Controla qué andén está ocupado y cuánto tarda cada carga o descarga.',
      ['Logística', 'Transporte'], 'package', 0, 0, false),
    makeSkill('vehiculos-patio', 'Vehículos en patio', 'Vehículos', 'soon', 'logistica',
      'Cuenta y ubica vehículos dentro del patio, sin depender de GPS.',
      ['Logística', 'Industria'], 'car', 0, 0, false),

    makeSkill('mesas', 'Mesas y clientes', 'Mesas', 'available', 'hosteleria',
      'Analiza ocupación de mesas y atención en salón.',
      ['Hostelería', 'Retail'], 'utensils', 100, 2, true, true),
    makeSkill('barra', 'Ocupación de barra', 'Barra', 'available', 'hosteleria',
      'Mide cuánta gente espera en barra y cuánto tarda en ser atendida. Piloto con simulación marcada sin cámara.',
      ['Hostelería'], 'users', 100, 1, false, true),
    makeSkill('servicio-mesas', 'Tiempo de servicio', 'Servicio', 'soon', 'hosteleria',
      'Estima el tiempo entre la llegada, el pedido y el cierre de cada mesa.',
      ['Hostelería'], 'clock', 0, 0, false),

    makeSkill('caidas', 'Detección de caídas', 'Caídas', 'available', 'salud',
      'Identifica personas caídas o situaciones de riesgo.',
      ['Salud', 'Seguridad privada', 'Hostelería', 'Industria'], 'alert', 100, 1, true, true),
    makeSkill('higiene-manos', 'Higiene de manos', 'Higiene', 'soon', 'salud',
      'Evalúa el lavado de manos en accesos y áreas clínicas críticas.',
      ['Salud', 'Hostelería'], 'droplets', 0, 0, false),
    makeSkill('ocupacion-camas', 'Ocupación de camas', 'Camas', 'soon', 'salud',
      'Estima camas ocupadas y libres sin sensores por cama.',
      ['Salud'], 'activity', 0, 0, false),

    makeSkill('altura-cinturon', 'Trabajo en altura', 'Altura', 'soon', 'construccion',
      'Verifica arnés y línea de vida en andamios y bordes de losa.',
      ['Construcción', 'Industria'], 'hard-hat', 0, 0, false),
    makeSkill('zona-grua', 'Zona de grúa', 'Zona de grúa', 'soon', 'construccion',
      'Detecta personas dentro del radio de carga de la grúa o la maquinaria.',
      ['Construcción', 'Industria'], 'alert', 0, 0, false),

    makeSkill('puestos-libres', 'Puestos libres', 'Puestos', 'available', 'oficinas',
      'Mide ocupación real de escritorios y salas de trabajo. Piloto con simulación marcada sin cámara.',
      ['Oficinas'], 'monitor', 100, 1, false, true),
    makeSkill('aforo-salas', 'Aforo de salas', 'Salas', 'available', 'oficinas',
      'Cuenta personas por sala y avisa cuando se supera la capacidad. Piloto con simulación marcada sin cámara.',
      ['Oficinas', 'Educación', 'Salud', 'Hostelería'], 'users', 100, 2, false, true),

    makeSkill('aforo-aulas', 'Aforo de aulas', 'Aulas', 'available', 'educacion',
      'Controla ocupación por aula y presencia de alumnos en horario. Piloto con simulación marcada sin cámara.',
      ['Educación'], 'book-open', 100, 1, false, true),
    makeSkill('evacuacion', 'Rutas de evacuación', 'Evacuación', 'soon', 'educacion',
      'Verifica que pasillos y salidas de emergencia permanezcan despejados.',
      ['Educación', 'Oficinas', 'Banca'], 'arrow-right', 0, 0, false),

    makeSkill('aforo-buses', 'Aforo en unidades', 'Unidades', 'soon', 'transporte',
      'Cuenta pasajeros que suben y bajan para estimar ocupación por unidad.',
      ['Transporte'], 'users', 0, 0, false),
    makeSkill('cabina-conductor', 'Estado del conductor', 'Cabina', 'soon', 'transporte',
      'Detecta somnolencia o distracción visible en la cabina del vehículo.',
      ['Transporte', 'Logística'], 'eye', 0, 0, false),

    makeSkill('intrusion-campo', 'Intrusión en campo', 'Campo', 'soon', 'agro',
      'Detecta personas o vehículos no autorizados en lotes y caminos rurales.',
      ['Agro'], 'shield-check', 0, 0, false),
    makeSkill('conteo-animales', 'Conteo de animales', 'Animales', 'soon', 'agro',
      'Cuenta animales en corrales, potreros y mangas de manejo.',
      ['Agro'], 'activity', 0, 0, false),

    makeSkill('acceso-sala-critica', 'Acceso a sala crítica', 'Sala crítica', 'soon', 'energia',
      'Controla el ingreso a salas de servidores, tableros y recintos sensibles.',
      ['Energía y data centers', 'Industria'], 'lock', 0, 0, false),
    makeSkill('puertas-abiertas', 'Puertas abiertas', 'Puertas', 'soon', 'energia',
      'Avisa cuando una puerta o reja queda abierta fuera del horario permitido.',
      ['Energía y data centers', 'Oficinas'], 'door', 0, 0, false),

    makeSkill('cajeros-atm', 'Cajeros y ATM', 'ATM', 'soon', 'banca',
      'Detecta uso del cajero, permanencia y presencia de más de una persona.',
      ['Banca'], 'money', 0, 0, false),
    makeSkill('aglomeracion-sucursal', 'Afluencia en sucursal', 'Afluencia', 'soon', 'banca',
      'Mide gente en sucursal y anticipa picos de atención en caja.',
      ['Banca', 'Retail'], 'users', 0, 0, false),

    makeSkill('dron-operacion', 'Operación de dron', 'Vuelo', 'training', 'drones',
      'Integra la cámara del dron, telemetría y patrullaje asistido sobre el software.',
      ['Seguridad privada', 'Industria', 'Logística', 'Construcción', 'Agro', 'Energía y data centers', 'Transporte'], 'drone', 35, 0, false),
    makeSkill('dron-perimetro', 'Patrullaje perimetral', 'Perímetro aéreo', 'soon', 'drones',
      'Recorre perímetros y detecta intrusos desde una cámara en movimiento.',
      ['Seguridad privada', 'Industria', 'Logística', 'Construcción', 'Agro', 'Energía y data centers'], 'shield-check', 0, 0, false),
    makeSkill('dron-conteo', 'Conteo aéreo de personas', 'Conteo aéreo', 'soon', 'drones',
      'Cuenta personas en patios, playas y eventos desde una vista elevada.',
      ['Seguridad privada', 'Logística', 'Agro', 'Transporte'], 'users', 0, 0, false),
    makeSkill('dron-epp', 'EPP desde dron', 'EPP aéreo', 'soon', 'drones',
      'Verifica casco y chaleco en cuadrillas distribuidas en obra o planta.',
      ['Industria', 'Construcción', 'Agro', 'Energía y data centers'], 'hard-hat', 0, 0, false),
    makeSkill('dron-termico', 'Inspección térmica', 'Térmico', 'soon', 'drones',
      'Detecta puntos calientes en tableros, cubiertas y paneles solares.',
      ['Energía y data centers', 'Industria', 'Agro'], 'thermometer', 0, 0, false),
    makeSkill('dron-inspeccion', 'Inspección de infraestructura', 'Inspección', 'soon', 'drones',
      'Revisa cubiertas, torres, silos y líneas sin exponer a un operario.',
      ['Construcción', 'Energía y data centers', 'Industria', 'Agro'], 'camera', 0, 0, false)
  ];

  var requests = [
    {
      id: 'req-1', type: 'company', companyId: null, companyName: 'Seguridad Integral Rosario',
      detail: 'Solicita acceso para 12 usuarios · Plan Profesional', date: 'Hoy 09:42', status: 'pending'
    },
    {
      id: 'req-2', type: 'skill', companyId: 'retail-centro', companyName: 'Retail Centro', skillId: 'colas',
      detail: 'Solicita activar Gestión de colas', date: 'Hoy 08:15', status: 'pending'
    },
    {
      id: 'req-3', type: 'seats', companyId: 'logistica-norte', companyName: 'Logística Norte',
      detail: 'Solicita 2 usuarios adicionales · 4/5 usados', date: 'Ayer 17:20', status: 'pending'
    },
    {
      id: 'req-4', type: 'renewal', companyId: 'hotel-alba', companyName: 'Hotel Alba',
      detail: 'Solicita renovar Plan Básico por 12 meses', date: 'Ayer 11:05', status: 'pending'
    }
  ];

  var cimNames = [
    ['María', 'Fernández'], ['Jorge', 'Salas'], ['Lucía', 'Ortega'], ['Diego', 'Ramos'],
    ['Carla', 'Méndez'], ['Pablo', 'Ibáñez'], ['Sofía', 'Ríos'], ['Andrés', 'Vidal']
  ];

  var firstNames = [
    'Valentina', 'Martín', 'Camila', 'Nicolás', 'Florencia', 'Gonzalo', 'Agustina', 'Federico',
    'Julieta', 'Matías', 'Rocío', 'Emiliano', 'Delfina', 'Tomás', 'Micaela', 'Bruno',
    'Paula', 'Leandro', 'Renata', 'Facundo'
  ];

  var lastNames = [
    'Paz', 'Acosta', 'Silva', 'Romero', 'Castro', 'Herrera', 'Luna', 'Molina', 'Suárez',
    'Pereyra', 'Gómez', 'Arias', 'Benítez', 'Medina', 'Navarro', 'Cabrera', 'Rojas', 'Vega',
    'Campos', 'Ferreyra'
  ];

  var cimLastAccess = ['Hace 2 min', 'Hace 18 min', 'Hace 5 min', 'Hace 1 h', 'Ayer', 'Hace 12 días', 'Hace 3 h', 'Hace 40 min'];
  var otherLastAccess = ['Hace 1 h', 'Ayer', 'Hace 3 días', 'Hace 20 min', 'Hace 2 días', 'Hace 5 h'];

  var users = [];
  var userCounter = 0;

  companies.forEach(function (company, companyIndex) {
    for (var i = 0; i < company.usersCount; i++) {
      var first;
      var last;

      if (company.id === 'cim' && cimNames[i]) {
        first = cimNames[i][0];
        last = cimNames[i][1];
      } else {
        first = firstNames[(companyIndex * 7 + i * 3) % firstNames.length];
        last = lastNames[(companyIndex * 11 + i * 5) % lastNames.length];
      }

      var role = i === 0 ? 'company_admin' : ((i === 1 || (company.id === 'cim' && i === 4)) ? 'supervisor' : 'operator');
      var inactive = company.id === 'cim' ? i === 5 : (i === 3 && companyIndex % 3 === 0);
      var emailFirst = AUTEC.utils.normalizeEmailPart(first);
      var emailLast = AUTEC.utils.normalizeEmailPart(last);
      userCounter++;

      users.push({
        id: 'u-' + userCounter,
        companyId: company.id,
        companyName: company.name,
        name: first + ' ' + last,
        email: emailFirst + '.' + emailLast + '@' + company.domain,
        role: role,
        status: inactive ? 'inactive' : 'active',
        lastAccess: company.id === 'cim' ? cimLastAccess[i] : otherLastAccess[(companyIndex + i) % otherLastAccess.length]
      });
    }
  });

  function companyById(id) {
    return companies.find(function (company) { return company.id === id; });
  }

  function findUser(companyId, role) {
    return users.find(function (user) {
      return user.companyId === companyId && user.role === role && user.status === 'active';
    }) || users.find(function (user) { return user.companyId === companyId; });
  }

  var sessionSpecs = [
    { companyId: 'cim', role: 'company_admin', ip: '192.168.1.24', startedAt: '08:12', lastSeen: 'Hace 2 min' },
    { companyId: 'cim', role: 'supervisor', ip: '192.168.1.31', startedAt: '08:20', lastSeen: 'Hace 18 min' },
    { companyId: 'cim', role: 'operator', ip: '192.168.1.42', startedAt: '09:05', lastSeen: 'Hace 5 min' },
    { companyId: 'planta-sur', role: 'supervisor', ip: '10.0.0.18', startedAt: '07:45', lastSeen: 'Hace 1 min' },
    { companyId: 'retail-centro', role: 'company_admin', ip: '192.168.0.12', startedAt: '10:02', lastSeen: 'Hace 7 min' },
    { companyId: 'constructora-andes', role: 'operator', ip: '10.0.1.55', startedAt: '06:30', lastSeen: 'Hace 22 min' },
    { companyId: 'clinica-valle', role: 'company_admin', ip: '192.168.2.9', startedAt: '09:40', lastSeen: 'Hace 12 min' }
  ];

  var sessions = sessionSpecs.map(function (spec, index) {
    var user = findUser(spec.companyId, spec.role);
    var company = companyById(spec.companyId);
    return {
      id: 's-' + (index + 1),
      userId: user.id,
      userName: user.name,
      companyId: company.id,
      companyName: company.name,
      role: spec.role,
      ip: spec.ip,
      startedAt: spec.startedAt,
      lastSeen: spec.lastSeen
    };
  });

  var audit = [
    {
      id: 'a-1', date: '11 nov 2026 · 10:42', actor: 'Administrador', action: 'Aprobó solicitud de skill',
      actionType: 'update', target: 'Gestión de colas · Retail Centro', companyId: 'retail-centro',
      companyName: 'Retail Centro', ip: '127.0.0.1'
    },
    {
      id: 'a-2', date: '11 nov 2026 · 10:15', actor: 'Administrador', action: 'Cambió plan',
      actionType: 'update', target: 'CIM Seguridad · Profesional', companyId: 'cim',
      companyName: 'CIM Seguridad', ip: '127.0.0.1'
    },
    {
      id: 'a-3', date: '11 nov 2026 · 09:58', actor: 'María Fernández', action: 'Creó usuario',
      actionType: 'create', target: 'Andrés Vidal · CIM Seguridad', companyId: 'cim',
      companyName: 'CIM Seguridad', ip: '192.168.1.24'
    },
    {
      id: 'a-4', date: '11 nov 2026 · 09:42', actor: 'Sistema', action: 'Nueva solicitud',
      actionType: 'request', target: 'Seguridad Integral Rosario', companyId: null,
      companyName: 'Seguridad Integral Rosario', ip: '—'
    },
    {
      id: 'a-5', date: '10 nov 2026 · 18:20', actor: 'Administrador', action: 'Suspendió empresa',
      actionType: 'delete', target: 'Puerto Nuevo', companyId: 'puerto-nuevo',
      companyName: 'Puerto Nuevo', ip: '127.0.0.1'
    },
    {
      id: 'a-6', date: '10 nov 2026 · 17:20', actor: 'Logística Norte', action: 'Solicitó usuarios',
      actionType: 'request', target: '2 asientos adicionales', companyId: 'logistica-norte',
      companyName: 'Logística Norte', ip: '192.168.1.88'
    },
    {
      id: 'a-7', date: '10 nov 2026 · 16:05', actor: 'Administrador', action: 'Activó skill',
      actionType: 'update', target: 'ReID · CIM Seguridad', companyId: 'cim',
      companyName: 'CIM Seguridad', ip: '127.0.0.1'
    },
    {
      id: 'a-8', date: '10 nov 2026 · 14:30', actor: 'Sistema', action: 'Plan vencido',
      actionType: 'system', target: 'Hotel Alba', companyId: 'hotel-alba',
      companyName: 'Hotel Alba', ip: '—'
    },
    {
      id: 'a-9', date: '10 nov 2026 · 12:10', actor: 'Administrador', action: 'Creó empresa',
      actionType: 'create', target: 'Clínica del Valle', companyId: 'clinica-valle',
      companyName: 'Clínica del Valle', ip: '127.0.0.1'
    },
    {
      id: 'a-10', date: '09 nov 2026 · 11:45', actor: 'Administrador', action: 'Registró pago',
      actionType: 'payment', target: 'Planta Sur · US$ 199', companyId: 'planta-sur',
      companyName: 'Planta Sur', ip: '127.0.0.1'
    },
    {
      id: 'a-11', date: '09 nov 2026 · 09:12', actor: 'María Fernández', action: 'Inició sesión',
      actionType: 'login', target: 'CIM Seguridad', companyId: 'cim',
      companyName: 'CIM Seguridad', ip: '192.168.1.24'
    },
    {
      id: 'a-12', date: '08 nov 2026 · 16:40', actor: 'Administrador', action: 'Rechazó solicitud',
      actionType: 'delete', target: 'Ampliación de usuarios · Hotel Alba', companyId: 'hotel-alba',
      companyName: 'Hotel Alba', ip: '127.0.0.1'
    }
  ];

  companies.forEach(function (company) {
    var plan = plans.find(function (item) { return item.id === company.planId; });
    if (company.status === 'trial') {
      company.payments = [];
      return;
    }
    company.payments = [
      { date: '12 oct 2026', concept: plan.name + ' · octubre', amount: plan.price, method: 'Transferencia', status: 'Pagado' },
      { date: '12 sep 2026', concept: plan.name + ' · septiembre', amount: plan.price, method: 'Transferencia', status: 'Pagado' },
      { date: '12 ago 2026', concept: plan.name + ' · agosto', amount: plan.price, method: 'Transferencia', status: 'Pagado' }
    ];
  });

  var monitoring = {
    camera: 'DroidCam · Entrada principal',
    status: 'En línea',
    fps: 24,
    latency: 38,
    resolution: '1280 × 720',
    timestamp: '14:32:08',
    reidMatches: 1,
    people: [
      { id: 1, confidence: 92, reid: false, box: { x: 33, y: 37, w: 10, h: 45 } },
      { id: 2, confidence: 87, reid: true, box: { x: 44, y: 37, w: 9, h: 45 } },
      { id: 3, confidence: 81, reid: false, box: { x: 66, y: 42, w: 10, h: 42 } }
    ],
    events: [
      { time: '14:32:08', text: 'Persona #2 reidentificada', type: 'reid' },
      { time: '14:31:54', text: 'Persona #3 detectada', type: 'person' },
      { time: '14:31:20', text: 'Persona #1 detectada', type: 'person' },
      { time: '14:30:02', text: 'Cámara conectada', type: 'system' }
    ]
  };

  var metrics = {
    adminMonths: ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'],
    mrr: [720, 810, 890, 940, 1010, 1055],
    companies: [4, 5, 5, 6, 7, 8],
    users: [38, 44, 51, 58, 64, 70],
    companyHours: ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'],
    companyPeople: [2, 5, 8, 12, 15, 18, 21, 17, 14, 9],
    companyReid: [0, 1, 1, 2, 2, 3, 3, 2, 2, 1]
  };

  var notifications = [
    { id: 'n-1', title: 'Nueva solicitud de empresa', text: 'Seguridad Integral Rosario solicitó acceso.', time: 'Hace 12 min', unread: true, type: 'request' },
    { id: 'n-2', title: 'Plan por vencer', text: 'Retail Centro vence en 7 días.', time: 'Hace 1 h', unread: true, type: 'warning' },
    { id: 'n-3', title: 'Pago registrado', text: 'Planta Sur pagó US$ 199.', time: 'Ayer', unread: false, type: 'payment' }
  ];

  AUTEC.data = {
    creator: creator,
    companies: companies,
    plans: plans,
    industries: industries,
    skillGroups: skillGroups,
    skills: skills,
    users: users,
    requests: requests,
    sessions: sessions,
    audit: audit,
    monitoring: monitoring,
    metrics: metrics,
    notifications: notifications
  };
})();
