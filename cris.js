// ===== MAPA DE INVESTIGAÇÃO - ORDEM PARANORMAL =====

// 1. Configurar o mapa com estilo urbano escuro
var map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
    center: { lat: -10.183549216947497, lng: -48.34577353930342 },
    zoom: 14,
});

// 2. Adicionar controles de navegação
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// 3. Adicionar escala do mapa
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: 'metric'
}), 'bottom-left');

// ===== VARIÁVEIS GLOBAIS =====
let addingLocation = false;
let tempMarker = null;
let allMarkers = [];
let activeFilters = {
    base: true,
    casa: true,
    loja: true,
    paranormal: true
};
let hoverFilter = null;
let showConnections = true;
let showMembranes = true;
let editingLocationId = null;
let editingZoneId = null;
let drawingZone = false;
let zoneDrawCoords = [];
const zoneDrawSourceId = 'zone-draw-source';
const zoneDrawLineId = 'zone-draw-line';
const zoneDrawFillId = 'zone-draw-fill';
const locationsStorageKey = 'crisLocations';
const defaultEditsStorageKey = 'crisDefaultEdits';
const zonesStorageKey = 'crisZones';
let defaultEdits = loadDefaultEdits();
let showDefaultFileLocations = true;
let defaultFileLocationIds = new Set();
let renderedZoneIds = new Set();
let membraneImageLoaded = false;
let membraneImage = null;
let membranePatternRegistered = false;

// ===== LOCAIS DE INVESTIGAÇÃO =====
let locations = [];
let defaultLocationsFromFile = [];
let defaultZonesFromFile = [];

// ===== CONEXOES ENTRE LOCAIS =====
let defaultConnections = [];
let connections = [];
let customLocations = [];
let zonesFromFile = [];

function getAllLocations() {
    return [...locations, ...customLocations];
}

function loadDefaultEdits() {
    try {
        const raw = localStorage.getItem(defaultEditsStorageKey);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
}

function saveDefaultEdits(edits) {
    localStorage.setItem(defaultEditsStorageKey, JSON.stringify(edits));
}

function loadZonesFromStorage() {
    try {
        const raw = localStorage.getItem(zonesStorageKey);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed.map((zone, index) => normalizeZone(zone, index));
    } catch (error) {
        return null;
    }
}

function saveZonesToStorage(zones) {
    localStorage.setItem(zonesStorageKey, JSON.stringify(zones));
}

function clearZonesStorage() {
    localStorage.removeItem(zonesStorageKey);
}

// ===== FUNÇÕES DE DEBUG =====
window.debugCRIS = {
    // Diagnostica o estado completo da aplicação
    diagnosticar: function() {
        console.log('=== 🔍 DIAGNÓSTICO DO CRIS ===');
        console.log('📌 Locais carregados:', locations.length);
        console.log('📌 Locais customizados:', customLocations.length);
        console.log('📍 Zonas carregadas:', zonesFromFile.length);
        console.log('🔗 Conexões:', connections.length);
        console.log('🖼️  Padrões de membrana registrados:', membranePatternRegistered);
        
        console.log('\n📍 ZONAS DETALHES:');
        zonesFromFile.forEach(z => {
            console.log(`   ID: ${z.id}`);
            console.log(`   Nome: ${z.name}`);
            console.log(`   Estado: ${z.membraneState}`);
            console.log(`   Padrão: ${z.fillPattern}`);
            console.log(`   Coordenadas: ${z.coordinates ? z.coordinates[0].length + ' pontos' : 'nenhuma'}`);
            console.log('');
        });
        
        // Verificar padrões registrados
        console.log('\n🖼️ PADRÕES REGISTRADOS:');
        Object.keys(membraneStates).forEach(state => {
            const pattern = membraneStates[state].pattern;
            const exists = map.hasImage(pattern);
            console.log(`   ${pattern}: ${exists ? '✓' : '✗'}`);
        });
    },
    
    // Limpa LocalStorage e recarrega
    limparCache: function() {
        console.log('🧹 Limpando cache...');
        localStorage.removeItem('crisLocations');
        localStorage.removeItem('crisZones');
        localStorage.removeItem('crisDefaultEdits');
        localStorage.removeItem('paranormalLocations');
        console.log('✓ Cache limpo. Recarregando página...');
        location.reload();
    },
    
    // Mostra o que está armazenado no LocalStorage
    mostraLocalStorage: function() {
        console.log('=== 💾 LOCAL STORAGE ===');
        console.log('crisLocations:', localStorage.getItem('crisLocations'));
        console.log('crisZones:', localStorage.getItem('crisZones'));
        console.log('crisDefaultEdits:', localStorage.getItem('crisDefaultEdits'));
        console.log('paranormalLocations:', localStorage.getItem('paranormalLocations'));
    }
};

// ===== ESTILOS DOS MARCADORES =====
const markerStyles = {
    'base': { color: '#00FF00', scale: 1.2 },
    'casa': { color: '#4169E1', scale: 1.0 },
    'loja': { color: '#FFD700', scale: 1.0 },
    'paranormal': { color: '#FF6347', scale: 1.1 }
};

// ===== ESTADOS DA MEMBRANA =====
const membraneBaseColor = '#ffffff';
const membraneStates = {
    intacta: {
        label: 'Intacta',
        fillOpacity: 0.15,
        lineWidth: 1.5,
        lineDasharray: null,
        pattern: 'membrane-texture-intacta'
    },
    estavel: {
        label: 'Estavel',
        fillOpacity: 0.25,
        lineWidth: 2,
        lineDasharray: [6, 2],
        pattern: 'membrane-texture-estavel'
    },
    danificada: {
        label: 'Danificada',
        fillOpacity: 0.40,
        lineWidth: 2.5,
        lineDasharray: [4, 3],
        pattern: 'membrane-texture-danificada'
    },
    arruinada: {
        label: 'Arruinada',
        fillOpacity: 0.60,
        lineWidth: 3,
        lineDasharray: [2, 2],
        pattern: 'membrane-texture-arruinada'
    },
    rompida: {
        label: 'Rompida',
        fillOpacity: 0.85,
        lineWidth: 3.5,
        lineDasharray: [1, 2],
        pattern: 'membrane-texture-rompida'
    }
};

function normalizeMembraneState(value) {
    if (!value) {
        return 'estavel';
    }
    const normalized = String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    return membraneStates[normalized] ? normalized : 'estavel';
}

function getMembraneStyle(stateKey) {
    return membraneStates[stateKey] || membraneStates.estavel;
}

// Função para carregar a imagem de membrana
function preloadMembraneImage() {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            membraneImage = img;
            membraneImageLoaded = true;
            console.log('✓ Imagem de membrana carregada com sucesso (', img.width, 'x', img.height, ')');
            resolve(true);
        };
        img.onerror = function(error) {
            console.error('✗ Erro ao carregar imagem de membrana:', error);
            membraneImageLoaded = false;
            resolve(false);
        };
        console.log('Iniciando carregamento de media/textura/membrana.png...');
        img.src = 'media/textura/membrana.png';
    });
}

function buildMembranePatternCanvas(stateKey) {
    const size = 32;  // Ainda menor para garantir compatibilidade
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        console.error(`[${stateKey}] Não foi possível obter contexto 2D do canvas`);
        return null;
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, size, size);

    // Se a imagem foi carregada, desenhar ela
    if (membraneImageLoaded && membraneImage) {
        console.log(`[${stateKey}] Usando imagem membrana.png carregada`);
        
        let globalOpacity = 0.5;
        if (stateKey === 'intacta') globalOpacity = 0.15;
        else if (stateKey === 'estavel') globalOpacity = 0.25;
        else if (stateKey === 'danificada') globalOpacity = 0.40;
        else if (stateKey === 'arruinada') globalOpacity = 0.60;
        else if (stateKey === 'rompida') globalOpacity = 0.85;
        
        try {
            ctx.globalAlpha = globalOpacity;
            ctx.drawImage(membraneImage, 0, 0, size, size);
            ctx.globalAlpha = 1.0;
        } catch (error) {
            console.warn(`[${stateKey}] Erro ao desenhar imagem, usando fallback:`, error);
        }
        
        return canvas;
    }
    
    // Fallback: Gerar nebulosa rosa proceduralmente (se membrana.png não carregar)
    console.warn(`[${stateKey}] Gerando nebulosa rosa proceduralmente`);
    
    let particleCount = 50;
    let opacity = 0.5;
    
    if (stateKey === 'intacta') {
        particleCount = 8;
        opacity = 0.15;
    } else if (stateKey === 'estavel') {
        particleCount = 12;
        opacity = 0.25;
    } else if (stateKey === 'danificada') {
        particleCount = 16;
        opacity = 0.40;
    } else if (stateKey === 'arruinada') {
        particleCount = 24;
        opacity = 0.60;
    } else if (stateKey === 'rompida') {
        particleCount = 32;
        opacity = 0.85;
    }
    
    // Cores rosa/avermelhada (como a imagem desejada)
    const baseHues = [
        'rgba(255, 200, 220, 0.3)',  // Rosa claro
        'rgba(255, 150, 180, 0.25)', // Rosa médio
        'rgba(255, 100, 150, 0.2)',  // Rosa escuro
        'rgba(240, 80, 120, 0.2)',   // Vermelho-rosa
        'rgba(255, 180, 200, 0.3)'   // Rosa pálido
    ];
    
    // Seed pseudo-aleatória
    const seed = stateKey.charCodeAt(0);
    let random = seed;
    
    function seededRandom() {
        random = (random * 9301 + 49297) % 233280;
        return random / 233280;
    }
    
    // Desenhar múltiplas camadas de círculos com padrão nebuloso
    for (let layer = 0; layer < 3; layer++) {  // Reduzido de 4 para 3 camadas
        const layerParticles = Math.floor(particleCount * (1 - layer * 0.2));
        
        for (let i = 0; i < layerParticles; i++) {
            const x = seededRandom() * size;
            const y = seededRandom() * size;
            const radius = 3 + seededRandom() * 8 + layer * 1.5;  // Reduzido substancialmente
            const hueIndex = Math.floor(seededRandom() * baseHues.length);
            
            // Criar gradiente radial rosa
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, baseHues[hueIndex]);
            gradient.addColorStop(0.5, baseHues[hueIndex].replace('0.', '0.1'));
            gradient.addColorStop(1, 'rgba(255, 200, 220, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Aplicar opacidade global ao todo
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(255, 200, 220, 0.1)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1.0;

    return canvas;
}

function registerMembranePatterns() {
    // Evitar registrar múltiplas vezes
    if (membranePatternRegistered) {
        console.log('✓ Padrões de membrana já registrados');
        return;
    }
    
    console.log('🎨 Registrando padrões de membrana (5 padrões únicos)...');
    let successCount = 0;
    let errorCount = 0;
    
    Object.keys(membraneStates).forEach((stateKey) => {
        const patternName = membraneStates[stateKey].pattern;
        
        // Verificar se já existe
        if (map.hasImage(patternName)) {
            console.log(`   ⚠️  Padrão "${patternName}" já existe, pulando...`);
            return;
        }
        
        try {
            const canvas = buildMembranePatternCanvas(stateKey);
            
            if (!canvas) {
                console.error(`   ✗ Canvas nulo para ${stateKey}`);
                errorCount++;
                return;
            }
            
            console.log(`   [${stateKey}] Canvas: ${canvas.width}x${canvas.height}`);
            
            map.addImage(patternName, canvas, { 
                pixelRatio: 1,
                sdf: false
            });
            
            // Verificar se foi realmente registrado
            if (map.hasImage(patternName)) {
                console.log(`   ✓ Padrão registrado: ${patternName}`);
                successCount++;
            } else {
                console.warn(`   ⚠️  Padrão ${patternName} não foi registrado corretamente`);
                errorCount++;
            }
        } catch (error) {
            console.error(`   ✗ Erro ao registrar ${patternName}:`, error.message);
            errorCount++;
        }
    });
    
    membranePatternRegistered = true;
    console.log(`✓ Registro concluído: ${successCount} sucesso, ${errorCount} erro(s)`);
}

function setMembraneVisibility(isVisible) {
    showMembranes = isVisible;
    renderedZoneIds.forEach((zoneId) => {
        const fillId = `${zoneId}-fill`;
        const borderId = `${zoneId}-border`;
        if (map.getLayer(fillId)) {
            map.setLayoutProperty(fillId, 'visibility', isVisible ? 'visible' : 'none');
        }
        if (map.getLayer(borderId)) {
            map.setLayoutProperty(borderId, 'visibility', isVisible ? 'visible' : 'none');
        }
    });
}

function getMembraneStateFromForm() {
    const select = document.getElementById('zone-state');
    return normalizeMembraneState(select ? select.value : 'estavel');
}

function updateMembraneStyleSummary(stateKey) {
    const summary = document.getElementById('zone-style-summary');
    if (!summary) {
        return;
    }
    const style = getMembraneStyle(stateKey);
    const dashLabel = style.lineDasharray ? style.lineDasharray.join(',') : 'solido';
    summary.textContent = `Estilo: borda ${style.lineWidth}px, opacidade ${style.fillOpacity}, tracejado ${dashLabel}`;
}

// ===== CACHE DE IMAGENS VÁLIDAS =====
const imageCache = {};

async function preloadPinImages() {
    const iconMap = {
        'base': 'media/icons/pin/icon_base.png',
        'casa': 'media/icons/pin/icon_casa.png',
        'loja': 'media/icons/pin/icon_Loja.png',
        'paranormal': 'media/icons/pin/Icon_paranormal.png'
    };

    for (const [type, path] of Object.entries(iconMap)) {
        try {
            const response = await fetch(path, { method: 'HEAD' });
            imageCache[type] = response.ok ? path : null;
        } catch (error) {
            imageCache[type] = null;
        }
    }
}

// ===== CRIAR PIN COM IMAGEM DE CATEGORIA =====
function createPinImage(type) {
    const validPath = imageCache[type];
    
    if (!validPath) {
        return ''; // Sem fallback - usa apenas a imagem da categoria
    }
    
    return `<img src="${validPath}" alt="${type}" style="width: 100%; height: 100%; object-fit: contain;">`;
}

function normalizeLocation(location) {
    if (location.type === 'agente') {
        location.type = 'casa';
    }
    if (location.type && location.type.startsWith('paranormal')) {
        location.type = 'paranormal';
    }
    location.name = stripLeadingIcon(location.name || '');
    if (location.type !== 'paranormal') {
        location.threat = 0;
    }
    if (location.type === 'paranormal' && !location.threat) {
        location.threat = 2;
    }
    return location;
}

function normalizeZone(zone, index) {
    // Se tem center e radiusMeters, regenera as coordenadas do círculo
    let coordinates = zone.coordinates;
    if (zone.center && zone.radiusMeters) {
        coordinates = createCirclePolygon(zone.center, zone.radiusMeters);
    }

    const membraneState = normalizeMembraneState(zone.membraneState);
    const membraneStyle = getMembraneStyle(membraneState);
    
    return {
        id: zone.id || `zone-${index}`,
        name: zone.name || 'Ponto de membrana',
        membraneState: membraneState,
        coordinates: coordinates,
        center: zone.center,
        radiusMeters: zone.radiusMeters,
        fillColor: membraneBaseColor,
        fillOpacity: membraneStyle.fillOpacity,
        fillPattern: membraneStyle.pattern,
        lineColor: membraneBaseColor,
        lineWidth: membraneStyle.lineWidth,
        lineDasharray: membraneStyle.lineDasharray ? [...membraneStyle.lineDasharray] : null
    };
}

function cloneZone(zone) {
    return {
        ...zone,
        coordinates: Array.isArray(zone.coordinates)
            ? zone.coordinates.map((ring) => ring.map((coord) => [coord[0], coord[1]]))
            : zone.coordinates,
        center: zone.center ? [...zone.center] : zone.center,
        radiusMeters: zone.radiusMeters,
        membraneState: zone.membraneState,
        fillPattern: zone.fillPattern,
        lineDasharray: Array.isArray(zone.lineDasharray) ? [...zone.lineDasharray] : zone.lineDasharray
    };
}

async function loadLocationsFromJson() {
    try {
        const [defaultResponse, response] = await Promise.all([
            fetch('CRIS-locaisdefault.json', { cache: 'no-store' }),
            fetch('CRIS-locais.json', { cache: 'no-store' })
        ]);

        if (!defaultResponse.ok) {
            throw new Error('Falha ao carregar CRIS-locaisdefault.json');
        }

        if (!response.ok) {
            throw new Error('Falha ao carregar CRIS-locais.json');
        }

        const defaultData = await defaultResponse.json();
        const data = await response.json();
        const defaultLocations = Array.isArray(defaultData.defaults)
            ? defaultData.defaults
            : Array.isArray(defaultData.locations)
                ? defaultData.locations
                : [];

        const extraDefaults = Array.isArray(data.defaults)
            ? data.defaults
            : [];
        
        console.log('📌 Locais padrão de CRIS-locaisdefault.json:', defaultLocations.length);
        console.log('📌 Locais extras de CRIS-locais.json:', extraDefaults.length);

        defaultLocationsFromFile = defaultLocations.map(loc => normalizeLocation({ ...loc }));
        defaultLocationsFromFile.forEach((loc, index) => {
            if (!loc.id) {
                loc.id = `default-${index}`;
            }
        });

        const extraDefaultsNormalized = extraDefaults.map(loc => normalizeLocation({ ...loc }));
        extraDefaultsNormalized.forEach((loc, index) => {
            if (!loc.id) {
                loc.id = `extra-default-${index}`;
            }
        });

        locations = [...defaultLocationsFromFile, ...extraDefaultsNormalized];
        defaultFileLocationIds = new Set(defaultLocationsFromFile.map(loc => loc.id));

        locations.forEach(loc => {
            if (defaultEdits[loc.id]) {
                Object.assign(loc, defaultEdits[loc.id]);
            }
        });

        const savedCustom = localStorage.getItem('paranormalLocations');
        if (savedCustom) {
            customLocations = JSON.parse(savedCustom).map((loc, index) => {
                if (!loc.id) {
                    loc.id = `${Date.now()}-${index}`;
                }
                return normalizeLocation(loc);
            });
        } else {
            customLocations = Array.isArray(data.custom)
                ? data.custom.map((loc, index) => {
                    if (!loc.id) {
                        loc.id = `${Date.now()}-${index}`;
                    }
                    return normalizeLocation({ ...loc });
                })
                : [];
        }

        defaultConnections = Array.isArray(defaultData.connections)
            ? defaultData.connections.map((conn, index) => ({
                id: conn.id || `conn-default-${index}`,
                fromId: conn.fromId,
                toId: conn.toId,
                color: conn.color || '#00FF00',
                label: conn.label || 'Conexao'
            }))
            : [];
        
        console.log('🔗 Conexões padrão:', defaultConnections.length);

        if (Array.isArray(data.connections) && data.connections.length > 0) {
            connections = data.connections.map((conn, index) => ({
                id: conn.id || `conn-${Date.now()}-${index}`,
                fromId: conn.fromId,
                toId: conn.toId,
                color: conn.color || '#00FF00',
                label: conn.label || 'Conexao'
            }));
            console.log('🔗 Conexões customizadas carregadas:', connections.length);
        } else {
            connections = [...defaultConnections];
            console.log('🔗 Usando conexões padrão');
        }

        defaultZonesFromFile = Array.isArray(defaultData.zones)
            ? defaultData.zones.map((zone, index) => normalizeZone(zone, index))
            : [];
        
        console.log('📍 Zonas carregadas de CRIS-locaisdefault.json:', defaultZonesFromFile.length);
        defaultZonesFromFile.forEach(zone => {
            console.log(`   - ${zone.id}: ${zone.name} (${zone.membraneState})`);
        });

        const storedZones = loadZonesFromStorage();
        console.log('💾 Zonas armazenadas em LocalStorage:', storedZones ? storedZones.length : 0);
        
        zonesFromFile = storedZones
            ? storedZones.map((zone) => cloneZone(zone))
            : defaultZonesFromFile.map((zone) => cloneZone(zone));
        
        console.log('✓ Zonas finais carregadas:', zonesFromFile.length);
        zonesFromFile.forEach(zone => {
            console.log(`   - ${zone.id}: ${zone.name} (${zone.membraneState})`);
        });
    } catch (error) {
        locations = [];
        customLocations = [];
        defaultConnections = [];
        connections = [];
        zonesFromFile = [];
        defaultZonesFromFile = [];
        defaultFileLocationIds = new Set();
        showNotification('Erro ao carregar cris-locais.json');
    }
}

function clearZonesFromMap() {
    renderedZoneIds.forEach((zoneId) => {
        const fillId = `${zoneId}-fill`;
        const borderId = `${zoneId}-border`;
        const sourceId = `${zoneId}-source`;
        if (map.getLayer(fillId)) {
            map.removeLayer(fillId);
        }
        if (map.getLayer(borderId)) {
            map.removeLayer(borderId);
        }
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });
    renderedZoneIds.clear();
}

function addZonesToMap() {
    console.log(`Adicionando ${zonesFromFile.length} zonas ao mapa`);
    
    zonesFromFile.forEach((zone) => {
        if (!Array.isArray(zone.coordinates)) {
            console.warn(`Zona ${zone.id} sem coordenadas válidas`);
            return;
        }

        const sourceId = `${zone.id}-source`;
        const fillId = `${zone.id}-fill`;
        const borderId = `${zone.id}-border`;

        if (map.getSource(sourceId)) {
            console.log(`Zona ${zone.id} já existe no mapa`);
            return;
        }

        map.addSource(sourceId, {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': zone.coordinates
                },
                'properties': {
                    'name': zone.name,
                    'zoneId': zone.id
                }
            }
        });

        const style = getMembraneStyle(normalizeMembraneState(zone.membraneState));
        const fillPaint = {
            'fill-color': zone.fillColor || membraneBaseColor,
            'fill-opacity': zone.fillOpacity
        };
        const fillPattern = zone.fillPattern || style.pattern;
        
        console.log(`Zona ${zone.id}: tentando usar padrão "${fillPattern}", existe? ${map.hasImage(fillPattern)}`);
        
        // Se o padrão existe, usar fill-pattern
        if (map.hasImage(fillPattern)) {
            fillPaint['fill-pattern'] = fillPattern;
            console.log(`✓ Zona ${zone.id} usando padrão`);
        } else {
            // Fallback: usar apenas fill-color com opacity aumentada
            console.warn(`⚠️  Padrão "${fillPattern}" não encontrado para zona ${zone.id}, usando fallback de cor`);
            // Aumentar a opacidade já que não há padrão
            fillPaint['fill-opacity'] = Math.min(zone.fillOpacity * 1.5, 0.8);
        }

        map.addLayer({
            'id': fillId,
            'type': 'fill',
            'source': sourceId,
            'paint': fillPaint,
            'layout': {
                'visibility': showMembranes ? 'visible' : 'none'
            }
        });

        const linePaint = {
            'line-color': zone.lineColor || membraneBaseColor,
            'line-width': zone.lineWidth
        };
        linePaint['line-dasharray'] = Array.isArray(zone.lineDasharray) && zone.lineDasharray.length
            ? zone.lineDasharray
            : [1, 0];

        map.addLayer({
            'id': borderId,
            'type': 'line',
            'source': sourceId,
            'paint': linePaint,
            'layout': {
                'visibility': showMembranes ? 'visible' : 'none'
            }
        });

        renderedZoneIds.add(zone.id);
        console.log(`Zona ${zone.id} adicionada ao mapa`);
    });
    
    console.log(`Total de zonas adicionadas: ${renderedZoneIds.size}`);
}

function showZoneContextMenu(lngLat, zoneName, zoneId) {
    // Remover menu anterior se existir
    const existingMenu = document.getElementById('zone-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'zone-context-menu';
    menu.style.cssText = `
        position: fixed;
        background: #1a1a1a;
        border: 2px solid #ff6b00;
        border-radius: 8px;
        padding: 8px 0;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        min-width: 150px;
    `;

    // Converter coordenadas do mapa para pixel
    const canvasCoords = map.project(lngLat);
    menu.style.left = canvasCoords.x + 'px';
    menu.style.top = canvasCoords.y + 'px';

    // Título
    const title = document.createElement('div');
    title.textContent = zoneName;
    title.style.cssText = `
        padding: 8px 16px;
        color: #ff6b00;
        font-weight: bold;
        border-bottom: 1px solid #ff6b00;
        font-size: 12px;
    `;
    menu.appendChild(title);

    // Botão Editar
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Editar';
    editBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        background: none;
        border: none;
        color: #00ff00;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.2s;
    `;
    editBtn.onmouseover = () => editBtn.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    editBtn.onmouseout = () => editBtn.style.backgroundColor = 'transparent';
    editBtn.onclick = () => {
        const zone = zonesFromFile.find((z) => z.id === zoneId);
        if (zone) {
            editingZoneId = zoneId;
            document.getElementById('zone-name').value = zone.name || '';
            document.getElementById('zone-coordinates').value = JSON.stringify(zone.coordinates || []);
            document.getElementById('zone-radius').value = String(zone.radiusMeters || 1000);
            document.getElementById('zone-state').value = normalizeMembraneState(zone.membraneState);
            updateMembraneStyleSummary(getMembraneStateFromForm());

            const indicator = document.getElementById('zone-editing-indicator');
            const indicatorName = document.getElementById('zone-editing-name');
            if (indicator && indicatorName) {
                indicatorName.textContent = zone.name || 'Zona';
                indicator.style.display = 'block';
            }

            if (zone.center) {
                zoneDrawCoords = [zone.center];
                window.zoneCenter = zone.center;
            } else if (zone.coordinates && zone.coordinates[0] && zone.coordinates[0].length > 0) {
                const coords = zone.coordinates[0];
                zoneDrawCoords = [coords[0]];
                window.zoneCenter = coords[0];
            }
            setZoneDrawMode(true);
            showNotification('>>> Modo edição: Ajuste o raio, visualize o preview e clique em "Confirmar Edição"');
        }
        menu.remove();
    };
    menu.appendChild(editBtn);

    // Botão Deletar
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Deletar';
    deleteBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        background: none;
        border: none;
        color: #ff0000;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.2s;
    `;
    deleteBtn.onmouseover = () => deleteBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    deleteBtn.onmouseout = () => deleteBtn.style.backgroundColor = 'transparent';
    deleteBtn.onclick = () => {
        if (confirm(`Deseja deletar a zona "${zoneName}"?`)) {
            zonesFromFile = zonesFromFile.filter((zone) => zone.id !== zoneId);
            saveZonesToStorage(zonesFromFile);
            rebuildZonesOnMap();
            renderZonesList();
            resetZoneForm();
            showNotification('✓ Zona deletada');
        }
        menu.remove();
    };
    menu.appendChild(deleteBtn);

    // Fechar ao clicar fora
    const closeMenu = (evt) => {
        if (evt.target !== menu && !menu.contains(evt.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);

    document.body.appendChild(menu);
}

function rebuildZonesOnMap() {
    if (!map || !map.isStyleLoaded()) {
        return;
    }
    clearZonesFromMap();
    addZonesToMap();
}

function clearZoneDrawPreview() {
    if (map.getLayer(zoneDrawFillId)) {
        map.removeLayer(zoneDrawFillId);
    }
    if (map.getLayer(zoneDrawLineId)) {
        map.removeLayer(zoneDrawLineId);
    }
    if (map.getLayer('zone-draw-center')) {
        map.removeLayer('zone-draw-center');
    }
    if (map.getSource(zoneDrawSourceId)) {
        map.removeSource(zoneDrawSourceId);
    }
}

// ===== FUNÇÕES DE ZONA CIRCULAR =====
function createCirclePolygon(center, radiusMeters) {
    const radiusKm = radiusMeters / 1000; // converter metros para km
    const steps = 64;
    const coordinates = [];
    
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * (Math.PI * 2);
        const dx = Math.cos(angle) * (radiusKm / 111); // 111 km por grau de latitude
        const dy = Math.sin(angle) * (radiusKm / (111 * Math.cos(center[1] * Math.PI / 180))); // ajusta para longitude
        coordinates.push([center[0] + dy, center[1] + dx]);
    }
    coordinates.push(coordinates[0]); // fecha o polígono
    return [coordinates];
}

function updateZoneDrawPreview() {
    if (!map || !map.isStyleLoaded()) {
        return;
    }

    const membraneState = getMembraneStateFromForm();
    const membraneStyle = getMembraneStyle(membraneState);
    if (!map.hasImage(membraneStyle.pattern)) {
        registerMembranePatterns();
    }

    const featureCollection = {
        type: 'FeatureCollection',
        features: []
    };

    // Se tem centro e raio, desenha círculo
    if (zoneDrawCoords.length === 1) {
        const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 0;
        if (radiusMeters > 0) {
            const circleCoords = createCirclePolygon(zoneDrawCoords[0], radiusMeters);
            document.getElementById('zone-coordinates').value = JSON.stringify(circleCoords);
            featureCollection.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: circleCoords
                },
                properties: { kind: 'fill' }
            });
        }
        
        // Marca o centro com um ponto
        featureCollection.features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: zoneDrawCoords[0]
            },
            properties: { kind: 'center' }
        });
    }

    if (!map.getSource(zoneDrawSourceId)) {
        map.addSource(zoneDrawSourceId, {
            type: 'geojson',
            data: featureCollection
        });

        // Layer de preenchimento do círculo
        map.addLayer({
            id: zoneDrawFillId,
            type: 'fill',
            source: zoneDrawSourceId,
            filter: ['==', ['get', 'kind'], 'fill'],
            paint: {
                'fill-color': membraneBaseColor,
                'fill-opacity': membraneStyle.fillOpacity,
                'fill-pattern': membraneStyle.pattern
            }
        });

        map.addLayer({
            id: zoneDrawLineId,
            type: 'line',
            source: zoneDrawSourceId,
            filter: ['==', ['get', 'kind'], 'fill'],
            paint: {
                'line-color': membraneBaseColor,
                'line-width': membraneStyle.lineWidth,
                'line-dasharray': membraneStyle.lineDasharray || [1, 0]
            }
        });
        
        // Layer do centro (ponto)
        map.addLayer({
            id: 'zone-draw-center',
            type: 'circle',
            source: zoneDrawSourceId,
            filter: ['==', ['get', 'kind'], 'center'],
            paint: {
                'circle-radius': 6,
                'circle-color': membraneBaseColor,
                'circle-opacity': 1
            }
        });
    } else {
        map.getSource(zoneDrawSourceId).setData(featureCollection);
        map.setPaintProperty(zoneDrawFillId, 'fill-opacity', membraneStyle.fillOpacity);
        map.setPaintProperty(zoneDrawFillId, 'fill-pattern', membraneStyle.pattern);
        map.setPaintProperty(zoneDrawLineId, 'line-width', membraneStyle.lineWidth);
        map.setPaintProperty(
            zoneDrawLineId,
            'line-dasharray',
            membraneStyle.lineDasharray || [1, 0]
        );
    }
}

function setZoneDrawMode(isActive) {
    drawingZone = isActive;
    const drawBtn = document.getElementById('zone-draw');
    const isEditing = editingZoneId !== null;

    if (drawBtn) {
        drawBtn.classList.toggle('active', isActive);
        drawBtn.textContent = isEditing
            ? 'Edicao Ativa'
            : (isActive ? 'Modo Desenho (clique para sair)' : 'Modo Desenho');
    }

    if (isActive) {
        if (addingLocation) {
            closeModal();
        }
        if (!isEditing) {
            zoneDrawCoords = [];
        }
        updateZoneDrawPreview();
        map.getCanvas().style.cursor = 'crosshair';
        map.doubleClickZoom.disable();
        const msg = isEditing 
            ? '>>> Modo edição: Clique para modificar o centro da zona'
            : '>>> Clique UMA VEZ no mapa para marcar o centro e ajuste o raio abaixo';
        showNotification(msg);
    } else {
        clearZoneDrawPreview();
        if (!isEditing) {
            zoneDrawCoords = [];
            window.zoneCenter = null;
        }
        map.getCanvas().style.cursor = '';
        map.doubleClickZoom.enable();
    }
}

function syncZoneCoordinatesFromDraw() {
    if (zoneDrawCoords.length !== 1) {
        return null;
    }
    const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 0;
    if (radiusMeters <= 0) {
        return null;
    }
    const center = zoneDrawCoords[0];
    const circleCoords = createCirclePolygon(center, radiusMeters);
    document.getElementById('zone-coordinates').value = JSON.stringify(circleCoords);
    window.zoneCenter = center;
    return circleCoords;
}

function buildPopupHtml(location) {
    const threatClass = location.threat >= 3 ? 'threat-high' : location.threat >= 2 ? 'threat-medium' : 'threat-low';
    const deleteBtn = '<button class="delete-location-btn" onclick="deleteLocation(\'' + location.id + '\')">Apagar Registro</button>';
    const editBtn = '<button class="edit-location-btn" onclick="editLocation(\'' + location.id + '\')">Editar Registro</button>';

    return `
        <div class="popup-content ${threatClass}">
            <h3>${location.name}</h3>
            <p><strong>${location.description}</strong></p>
            <p class="popup-info">${location.info}</p>
            ${editBtn}
            ${deleteBtn}
        </div>
    `;
}

// ===== FUNÇÃO PARA CRIAR MARCADOR =====
function createMarker(location) {
    const style = markerStyles[location.type] || { color: '#00FF00', scale: 1.0 };
    
    // Criar elemento customizado do marcador com imagem de categoria
    const el = document.createElement('div');
    el.className = `marker marker-${location.type}`;
    el.style.width = `${32 * style.scale}px`;
    el.style.height = `${40 * style.scale}px`;
    el.style.cursor = 'pointer';
    el.style.filter = `drop-shadow(0 0 8px ${style.color})`;
    el.style.zIndex = '1';
    el.style.pointerEvents = 'auto';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    
    // Adicionar a imagem
    const imgHtml = createPinImage(location.type);
    if (imgHtml) {
        el.innerHTML = imgHtml;
    } else {
        return null;
    }
    
    // Criar popup com informações
    const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(buildPopupHtml(location));
    
    // Adicionar marcador ao mapa COM ELEMENTO CUSTOMIZADO
    const marker = new maplibregl.Marker({ element: el })
        .setLngLat(location.coords)
        .setPopup(popup)
        .addTo(map);
    
    // Efeito hover
    el.addEventListener('mouseenter', () => {
        if (!hoverFilter) {
            el.style.width = `${32 * style.scale * 1.2}px`;
            el.style.height = `${40 * style.scale * 1.2}px`;
            el.style.filter = `drop-shadow(0 0 12px ${style.color})`;
        }
    });
    
    el.addEventListener('mouseleave', () => {
        if (!hoverFilter) {
            el.style.width = `${32 * style.scale}px`;
            el.style.height = `${40 * style.scale}px`;
            el.style.filter = `drop-shadow(0 0 8px ${style.color})`;
        }
    });
    
    // Armazenar informações do marcador
    const markerData = {
        marker: marker,
        element: el,
        location: location,
        type: location.type,
        isVisible: true,
        popup: popup,
        id: location.id
    };
    
    allMarkers.push(markerData);
    applyFilters();
    return marker;
}

// ===== SALVAR LOCAIS =====
function saveLocations() {
    localStorage.setItem(locationsStorageKey, JSON.stringify(locations));
}

function saveCustomLocations() {
    localStorage.setItem('paranormalLocations', JSON.stringify(customLocations));
}

// ===== DELETAR LOCAL =====
function deleteLocation(id) {
    locations = locations.filter(loc => loc.id !== id);
    customLocations = customLocations.filter(loc => loc.id !== id);
    connections = connections.filter(conn => conn.fromId !== id && conn.toId !== id);
    defaultFileLocationIds.delete(id);
    const markerObj = allMarkers.find(m => m.id === id);
    if (markerObj) {
        markerObj.marker.remove();
        allMarkers = allMarkers.filter(m => m.id !== id);
    }
    saveLocations();
    saveCustomLocations();
    refreshConnectionOptions();
    renderConnectionList();
    renderZonesList();
    if (showConnections) {
        updateConnections();
    }
}

// ===== ADICIONAR MARCADORES AO MAPA =====
map.on('load', async function() {
    console.log('=== INICIANDO CARREGAMENTO DO MAPA ===');
    console.log('📄 Arquivos a carregar:');
    console.log('   1. CRIS-locaisdefault.json (padrão com dados)');
    console.log('   2. CRIS-locais.json (customizações)');
    
    // Precarregar e validar imagens de pins
    console.log('\nPasso 1: Precarregando imagens de pins...');
    await preloadPinImages();
    console.log('Passo 1 concluído');
    
    // Carregar imagem de membrana
    console.log('Passo 2: Precarregando imagem de membrana...');
    await preloadMembraneImage();
    console.log('Passo 2 concluído. membraneImageLoaded =', membraneImageLoaded);
    
    // Registrar padrões de membrana ANTES de carregar zonas
    console.log('Passo 3: Registrando padrões de membrana...');
    try {
        registerMembranePatterns();
        console.log('✓ Passo 3 concluído - Padrões registrados');
    } catch (error) {
        console.error('✗ Passo 3 ERRO ao registrar padrões:', error);
    }
    
    console.log('Passo 4: Carregando dados de JSON...');
    await loadLocationsFromJson();
    console.log('Passo 4 concluído. zonesFromFile.length =', zonesFromFile.length);

    // Adicionar locais padrão
    locations.forEach(location => createMarker(location, false));
    
    // Adicionar locais customizados
    customLocations.forEach(location => createMarker(location, true));

    refreshConnectionOptions();
    renderConnectionList();
    
    // Adicionar layer de conexões
    map.addSource('connections', {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': []
        }
    });
    
    map.addLayer({
        'id': 'connections-layer',
        'type': 'line',
        'source': 'connections',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2]
        }
    });

    // Adicionar zonas ao mapa (padrões já estão registrados)
    console.log('Passo 5: Adicionando zonas ao mapa...');
    addZonesToMap();
    console.log('Passo 5 concluído');
    
    updateConnections();
    
    // Renderizar lista de zonas no painel
    renderZonesList();
    
    document.getElementById('toggle-connections').classList.add('active');
    document.getElementById('toggle-connections').innerHTML = '🔗 Ocultar Conexoes';
    
    console.log('=== CARREGAMENTO DO MAPA CONCLUÍDO ===');
});

// ===== LEGENDA =====
const legend = document.createElement('div');
legend.className = 'legend panel-hidden';
legend.id = 'summary-panel';
legend.innerHTML = `
    <h4>C.R.I.S.<span class="toggle-btn">▼</span></h4>
    <div class="legend-content">
        <div class="legend-section">
            <div class="legend-title">UNIDADES ORDO REALITAS</div>
            <div class="legend-item legend-filter" data-filter="base"><img src="media/icons/pin/icon_base.png" alt="base" style="width: 20px; height: 25px; object-fit: contain; margin-right: 6px; vertical-align: middle;"> Bases</div>
            <div class="legend-item legend-filter" data-filter="casa"><img src="media/icons/pin/icon_casa.png" alt="casa" style="width: 20px; height: 25px; object-fit: contain; margin-right: 6px; vertical-align: middle;"> Casas</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">PONTOS DE SUPORTE</div>
            <div class="legend-item legend-filter" data-filter="loja"><img src="media/icons/pin/icon_Loja.png" alt="loja" style="width: 20px; height: 25px; object-fit: contain; margin-right: 6px; vertical-align: middle;"> Lojas/Contatos</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">REGISTRO DO PARANORMAL</div>
            <div class="legend-item legend-filter" data-filter="paranormal"><img src="media/icons/pin/Icon_paranormal.png" alt="paranormal" style="width: 20px; height: 25px; object-fit: contain; margin-right: 6px; vertical-align: middle;"> Manifestacoes</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">TIPOS DE CONEXÃO</div>
            <div class="legend-item"><span style="background: #4169E1; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Investigacao Ativa</div>
            <div class="legend-item"><span style="background: #00FF00; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Monitoramento</div>
            <div class="legend-item"><span style="background: #FFD700; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Fonte de Informacao</div>
            <div class="legend-item"><span style="background: #DC143C; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Possivel Relacao</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">MEMBRANA</div>
            <div class="legend-item legend-toggle" id="toggle-membranes">Membranas: Ativas</div>
        </div>
    </div>
`;
document.body.appendChild(legend);

// Adicionar funcionalidade de minimizar
legend.querySelector('h4').addEventListener('click', () => {
    legend.classList.toggle('minimized');
});

// Hover e clique nos filtros do sumário (logo após criar o legend)
legend.querySelectorAll('.legend-item.legend-filter').forEach(item => {
    item.addEventListener('mouseenter', () => {
        hoverFilter = item.dataset.filter || null;
        applyFilters();
    });

    item.addEventListener('mouseleave', () => {
        hoverFilter = null;
        applyFilters();
    });

    item.addEventListener('click', () => {
        const filter = item.dataset.filter;
        item.classList.toggle('inactive');
        toggleFilter(filter);
    });
});

const membraneToggle = document.getElementById('toggle-membranes');
if (membraneToggle) {
    membraneToggle.addEventListener('click', () => {
        showMembranes = !showMembranes;
        setMembraneVisibility(showMembranes);
        membraneToggle.textContent = showMembranes ? 'Membranas: Ativas' : 'Membranas: Ocultas';
        membraneToggle.classList.toggle('inactive', !showMembranes);
    });
}

// ===== SISTEMA DE PAINEIS =====
const panelStack = document.createElement('div');
panelStack.className = 'panel-stack';
document.body.appendChild(panelStack);

// ===== PAINEL DE CONEXOES =====
const connectionContainer = document.createElement('div');
connectionContainer.className = 'panel connection-panel panel-hidden';
connectionContainer.id = 'connection-panel';
connectionContainer.innerHTML = `
    <div class="filter-title">CONEXOES ENTRE LOCAIS</div>
    <button class="connection-toggle-btn" id="toggle-connections">🔗 Mostrar Conexoes</button>
    <div class="connection-form">
        <label for="connection-from">Origem</label>
        <select id="connection-from"></select>
        <label for="connection-to">Destino</label>
        <select id="connection-to"></select>
        <label for="connection-label">Rotulo</label>
        <input type="text" id="connection-label" placeholder="Ex: Investigacao" />
        <label for="connection-color">Cor</label>
        <input type="color" id="connection-color" value="#00FF00" />
        <button class="data-btn" id="add-connection">Adicionar Conexao</button>
    </div>
    <div class="connection-list" id="connection-list"></div>
`;
panelStack.appendChild(connectionContainer);

// ===== PAINEL DE ZONAS =====
const zonesContainer = document.createElement('div');
zonesContainer.className = 'panel zones-panel panel-hidden';
zonesContainer.id = 'zones-panel';
zonesContainer.innerHTML = `
    <div class="filter-title">ZONAS DE MEMBRANA</div>
    <div class="zone-note">Pontos onde a membrana e mais fraca.</div>
    <div class="zone-list" id="zone-list"></div>
    <div class="zone-form">
        <div id="zone-editing-indicator" class="zone-editing-indicator" style="display: none; color: #FFD700; margin-bottom: 8px; font-weight: bold;">
            ✎ Editando: <span id="zone-editing-name"></span>
        </div>
        <label for="zone-name">Nome</label>
        <input type="text" id="zone-name" placeholder="Ponto de membrana" />
        <label for="zone-state">Estado da membrana</label>
        <select id="zone-state">
            <option value="intacta">Intacta</option>
            <option value="estavel" selected>Estavel</option>
            <option value="danificada">Danificada</option>
            <option value="arruinada">Arruinada</option>
            <option value="rompida">Rompida</option>
        </select>
        <div id="zone-style-summary" class="zone-style-summary"></div>
        <div class="zone-draw-actions">
            <button class="data-btn" id="zone-draw">Modo Desenho</button>
        </div>
        <label for="zone-radius">Raio (m)</label>
        <input type="number" id="zone-radius" min="100" max="50000" step="10" value="1000" />
        <textarea id="zone-coordinates" class="zone-coordinates-hidden" aria-hidden="true"></textarea>
        <button class="data-btn" id="zone-save">Salvar Zona</button>
        <details class="zone-advanced">
            <summary>Avancado</summary>
            <button class="data-btn" id="zone-reset">Restaurar do Arquivo</button>
        </details>
    </div>
`;
panelStack.appendChild(zonesContainer);

// ===== PAINEL DE DADOS =====
const dataContainer = document.createElement('div');
dataContainer.className = 'panel data-panel panel-hidden';
dataContainer.id = 'data-panel';
dataContainer.innerHTML = `
    <div class="filter-title">DADOS</div>
    <div class="data-buttons">
        <button class="data-btn" id="export-json">Exportar JSON</button>
        <button class="data-btn" id="import-json">Importar JSON</button>
        <input type="file" id="import-json-input" accept="application/json" />
    </div>
    <button class="data-btn" id="toggle-default-file">Ocultar Defaults (Arquivo)</button>
    <label class="data-option">
        <input type="checkbox" id="export-with-defaults" checked />
        Incluir defaults no export
    </label>
`;
panelStack.appendChild(dataContainer);

// ===== PAINEL DE CONTROLE DOS PAINEIS =====
const panelControls = document.createElement('div');
panelControls.className = 'panel-controls';
panelControls.innerHTML = `
    <button class="panel-btn" data-panel="summary">Mostrar Sumario</button>
    <button class="panel-btn" data-panel="connections">Mostrar Conexoes</button>
    <button class="panel-btn" data-panel="data">Mostrar Dados</button>
`;
document.body.appendChild(panelControls);

function togglePanel(panelElement, buttonElement, label) {
    const isHidden = panelElement.classList.toggle('panel-hidden');
    buttonElement.innerHTML = isHidden ? `Mostrar ${label}` : `Ocultar ${label}`;
}

panelControls.querySelector('[data-panel="summary"]').addEventListener('click', (event) => {
    togglePanel(legend, event.currentTarget, 'Sumario');
});

panelControls.querySelector('[data-panel="connections"]').addEventListener('click', (event) => {
    togglePanel(connectionContainer, event.currentTarget, 'Conexoes');
});

panelControls.querySelector('[data-panel="data"]').addEventListener('click', (event) => {
    togglePanel(dataContainer, event.currentTarget, 'Dados');
});

function makePanelDraggable(panel, handleSelector) {
    const handle = panel.querySelector(handleSelector);
    if (!handle) {
        return;
    }

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = (event) => {
        if (!isDragging) {
            return;
        }
        const panelRect = panel.getBoundingClientRect();
        const maxLeft = window.innerWidth - panelRect.width;
        const maxTop = window.innerHeight - panelRect.height;
        const rawLeft = event.clientX - offsetX;
        const rawTop = event.clientY - offsetY;
        const clampedLeft = Math.max(0, Math.min(rawLeft, maxLeft));
        const clampedTop = Math.max(0, Math.min(rawTop, maxTop));
        panel.style.left = `${clampedLeft}px`;
        panel.style.top = `${clampedTop}px`;
    };

    const onMouseUp = () => {
        if (!isDragging) {
            return;
        }
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (event) => {
        if (event.button !== 0) {
            return;
        }
        const rect = panel.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.zIndex = '1000';
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        isDragging = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

makePanelDraggable(legend, 'h4');
makePanelDraggable(connectionContainer, '.filter-title');
makePanelDraggable(zonesContainer, '.filter-title');
makePanelDraggable(dataContainer, '.filter-title');

// Função de filtro
function toggleFilter(filterType) {
    activeFilters[filterType] = !activeFilters[filterType];
    applyFilters();
}

function getCategoryFromType(type) {
    if (type === 'base') return 'base';
    if (type === 'casa') return 'casa';
    if (type === 'loja') return 'loja';
    return 'paranormal';
}

function applyFilters() {
    allMarkers.forEach(markerData => {
        const categoryFilter = getCategoryFromType(markerData.type);
        let shouldShow = activeFilters[categoryFilter];
        const isHovering = Boolean(hoverFilter);
        const isMatch = hoverFilter === categoryFilter;

        if (!showDefaultFileLocations && defaultFileLocationIds.has(markerData.id)) {
            shouldShow = false;
        }

        if (shouldShow && !markerData.isVisible) {
            markerData.marker.addTo(map);
            markerData.isVisible = true;
        }

        if (!shouldShow && markerData.isVisible) {
            markerData.marker.remove();
            markerData.isVisible = false;
        }

        if (markerData.isVisible) {
            if (isHovering && isMatch) {
                // HIGHLIGHT
                const highlightStyle = markerStyles[markerData.type] || { color: '#00FF00', scale: 1.0 };
                const baseWidth = 32 * highlightStyle.scale;
                const baseHeight = 40 * highlightStyle.scale;
                markerData.element.style.width = `${baseWidth * 1.3}px`;
                markerData.element.style.height = `${baseHeight * 1.3}px`;
                markerData.element.style.opacity = '1';
                markerData.element.style.filter = `drop-shadow(0 0 25px ${highlightStyle.color}) drop-shadow(0 0 45px ${highlightStyle.color})`;
            } else if (isHovering && !isMatch) {
                // DIM
                const dimStyle = markerStyles[markerData.type] || { color: '#00FF00', scale: 1.0 };
                const baseWidth = 32 * dimStyle.scale;
                const baseHeight = 40 * dimStyle.scale;
                markerData.element.style.width = `${baseWidth * 0.8}px`;
                markerData.element.style.height = `${baseHeight * 0.8}px`;
                markerData.element.style.opacity = '0.15';
                markerData.element.style.filter = `grayscale(1) drop-shadow(0 0 2px ${dimStyle.color})`;
            } else {
                // RESTAURAR PADRÃO
                const style = markerStyles[markerData.type] || { color: '#00FF00', scale: 1.0 };
                markerData.element.style.width = `${32 * style.scale}px`;
                markerData.element.style.height = `${40 * style.scale}px`;
                markerData.element.style.opacity = '1';
                markerData.element.style.filter = `drop-shadow(0 0 8px ${style.color})`;
            }
        }
    });
}

// ===== SISTEMA DE CONEXÕES =====
function updateConnections() {
    if (!showConnections) {
        map.getSource('connections').setData({
            'type': 'FeatureCollection',
            'features': []
        });
        return;
    }
    
    const allLocations = getAllLocations();
    const features = connections.map(conn => {
        if (!showDefaultFileLocations) {
            if (defaultFileLocationIds.has(conn.fromId) || defaultFileLocationIds.has(conn.toId)) {
                return null;
            }
        }
        const fromLoc = allLocations.find(l => l.id === conn.fromId);
        const toLoc = allLocations.find(l => l.id === conn.toId);
        
        if (!fromLoc || !toLoc) return null;
        
        return {
            'type': 'Feature',
            'properties': {
                'color': conn.color,
                'label': conn.label
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': [fromLoc.coords, toLoc.coords]
            }
        };
    }).filter(f => f !== null);
    
    map.getSource('connections').setData({
        'type': 'FeatureCollection',
        'features': features
    });
}

function refreshConnectionOptions() {
    const fromSelect = document.getElementById('connection-from');
    const toSelect = document.getElementById('connection-to');
    if (!fromSelect || !toSelect) {
        return;
    }

    const allLocations = getAllLocations();
    const optionHtml = allLocations.map(loc => {
        const safeName = (loc.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<option value="${loc.id}">${safeName}</option>`;
    }).join('');

    fromSelect.innerHTML = optionHtml;
    toSelect.innerHTML = optionHtml;
}

function renderConnectionList() {
    const list = document.getElementById('connection-list');
    if (!list) {
        return;
    }

    const allLocations = getAllLocations();
    if (!connections.length) {
        list.innerHTML = '<div class="connection-empty">Sem conexoes registradas.</div>';
        return;
    }

    list.innerHTML = connections.map(conn => {
        const fromLoc = allLocations.find(l => l.id === conn.fromId);
        const toLoc = allLocations.find(l => l.id === conn.toId);
        const fromName = fromLoc ? fromLoc.name : 'Origem desconhecida';
        const toName = toLoc ? toLoc.name : 'Destino desconhecido';
        const label = conn.label ? ` - ${conn.label}` : '';
        return `
            <div class="connection-item">
                <span class="connection-color" style="background:${conn.color}"></span>
                <span class="connection-text">${fromName} -> ${toName}${label}</span>
                <button class="connection-remove" data-connection-id="${conn.id}">Remover</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.connection-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const connectionId = btn.getAttribute('data-connection-id');
            connections = connections.filter(conn => conn.id !== connectionId);
            renderConnectionList();
            if (showConnections) {
                updateConnections();
            }
        });
    });
}

function resetZoneForm() {
    editingZoneId = null;
    window.zoneCenter = null;
    document.getElementById('zone-name').value = '';
    document.getElementById('zone-coordinates').value = '';
    document.getElementById('zone-radius').value = '1000';
    document.getElementById('zone-state').value = 'estavel';
    updateMembraneStyleSummary('estavel');
    
    // Esconder indicador de edição
    const indicator = document.getElementById('zone-editing-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function renderZonesList() {
    const list = document.getElementById('zone-list');
    if (!list) {
        return;
    }

    if (!zonesFromFile.length) {
        list.innerHTML = '<div class="zone-empty">Sem zonas registradas.</div>';
        return;
    }

    list.innerHTML = zonesFromFile.map((zone) => {
        const safeName = (zone.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const stateKey = normalizeMembraneState(zone.membraneState);
        const stateLabel = getMembraneStyle(stateKey).label;
        return `
            <div class="zone-item" data-state="${stateKey}">
                <span class="zone-color" data-state="${stateKey}"></span>
                <span class="zone-text">${safeName}</span>
                <span class="zone-state" data-state="${stateKey}">${stateLabel}</span>
                <button class="zone-edit" data-zone-id="${zone.id}">Editar</button>
                <button class="zone-remove" data-zone-id="${zone.id}">Remover</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.zone-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
            const zoneId = btn.getAttribute('data-zone-id');
            const zone = zonesFromFile.find((item) => item.id === zoneId);
            if (!zone) {
                return;
            }
            editingZoneId = zoneId;
            document.getElementById('zone-name').value = zone.name || '';
            document.getElementById('zone-coordinates').value = JSON.stringify(zone.coordinates || []);
            document.getElementById('zone-radius').value = String(zone.radiusMeters || 1000);
            document.getElementById('zone-state').value = normalizeMembraneState(zone.membraneState);
            updateMembraneStyleSummary(getMembraneStateFromForm());
            
            // Mostrar indicador de edição
            const indicator = document.getElementById('zone-editing-indicator');
            const indicatorName = document.getElementById('zone-editing-name');
            if (indicator && indicatorName) {
                indicatorName.textContent = zone.name || 'Zona';
                indicator.style.display = 'block';
            }
            
            // Entrar em modo de edição visual
            if (zone.center) {
                zoneDrawCoords = [zone.center];
                window.zoneCenter = zone.center;
            } else if (zone.coordinates && zone.coordinates[0] && zone.coordinates[0].length > 0) {
                const coords = zone.coordinates[0];
                // Tenta usar o primeiro ponto como centro (aproximação)
                zoneDrawCoords = [coords[0]];
                window.zoneCenter = coords[0];
            }
            setZoneDrawMode(true);
            showNotification('>>> Modo edição: Ajuste o raio, visualize o preview e clique em "Confirmar Edição"');
        });
    });

    list.querySelectorAll('.zone-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
            const zoneId = btn.getAttribute('data-zone-id');
            zonesFromFile = zonesFromFile.filter((zone) => zone.id !== zoneId);
            saveZonesToStorage(zonesFromFile);
            rebuildZonesOnMap();
            renderZonesList();
            resetZoneForm();
        });
    });
}

// Toggle de conexões
document.getElementById('toggle-connections').addEventListener('click', function() {
    showConnections = !showConnections;
    this.classList.toggle('active');
    this.innerHTML = showConnections ? '🔗 Ocultar Conexoes' : '🔗 Mostrar Conexoes';
    updateConnections();
});

document.getElementById('add-connection').addEventListener('click', (event) => {
    event.preventDefault();
    const fromId = document.getElementById('connection-from').value;
    const toId = document.getElementById('connection-to').value;
    const label = document.getElementById('connection-label').value.trim();
    const color = document.getElementById('connection-color').value || '#00FF00';

    if (!fromId || !toId) {
        showNotification('Selecione origem e destino');
        return;
    }

    if (fromId === toId) {
        showNotification('Origem e destino devem ser diferentes');
        return;
    }

    connections.push({
        id: `conn-${Date.now()}`,
        fromId,
        toId,
        color,
        label: label || 'Conexao'
    });

    document.getElementById('connection-label').value = '';
    renderConnectionList();
    if (showConnections) {
        updateConnections();
    }
});

document.getElementById('toggle-default-file').addEventListener('click', () => {
    showDefaultFileLocations = !showDefaultFileLocations;
    const btn = document.getElementById('toggle-default-file');
    btn.textContent = showDefaultFileLocations
        ? 'Ocultar Defaults (Arquivo)'
        : 'Mostrar Defaults (Arquivo)';
    applyFilters();
    if (showConnections) {
        updateConnections();
    }
});

// ===== ZONAS =====
// Atualizar preview quando raio muda
document.getElementById('zone-radius').addEventListener('input', () => {
    if (drawingZone && zoneDrawCoords.length === 1) {
        updateZoneDrawPreview();
    }
});

document.getElementById('zone-state').addEventListener('change', () => {
    const stateKey = getMembraneStateFromForm();
    updateMembraneStyleSummary(stateKey);
    if (drawingZone && zoneDrawCoords.length === 1) {
        updateZoneDrawPreview();
    }
});

updateMembraneStyleSummary(getMembraneStateFromForm());

document.getElementById('zone-save').addEventListener('click', (event) => {
    event.preventDefault();
    const name = document.getElementById('zone-name').value.trim() || 'Ponto de membrana';
    const coordsRaw = document.getElementById('zone-coordinates').value.trim();
    const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 1000;
    const membraneState = getMembraneStateFromForm();
    const membraneStyle = getMembraneStyle(membraneState);

    let coordsValue = coordsRaw;
    if (drawingZone) {
        const synced = syncZoneCoordinatesFromDraw();
        coordsValue = synced ? JSON.stringify(synced) : '';
        if (!coordsValue) {
            showNotification('Marque o centro da zona antes de salvar');
            return;
        }
        setZoneDrawMode(false);
    }

    if (!coordsValue) {
        showNotification('Informe as coordenadas da zona');
        return;
    }

    let coordinates;
    try {
        coordinates = JSON.parse(coordsValue);
    } catch (error) {
        showNotification('Coordenadas invalidas');
        return;
    }

    if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
        showNotification('Formato de coordenadas invalido');
        return;
    }

    const zonePayload = normalizeZone({
        id: editingZoneId || `zone-${Date.now()}`,
        name,
        membraneState: membraneState,
        coordinates,
        radiusMeters,
        center: window.zoneCenter || (coordinates[0] ? coordinates[0][0] : null),
        fillColor: membraneBaseColor,
        fillOpacity: membraneStyle.fillOpacity,
        lineColor: membraneBaseColor,
        lineWidth: membraneStyle.lineWidth,
        lineDasharray: membraneStyle.lineDasharray
    }, zonesFromFile.length);

    if (editingZoneId) {
        zonesFromFile = zonesFromFile.map((zone) => zone.id === editingZoneId ? zonePayload : zone);
    } else {
        zonesFromFile.push(zonePayload);
    }

    saveZonesToStorage(zonesFromFile);
    rebuildZonesOnMap();
    renderZonesList();
    resetZoneForm();
});

document.getElementById('zone-reset').addEventListener('click', (event) => {
    event.preventDefault();
    const confirmed = confirm('Restaurar do arquivo vai apagar as zonas atuais. Continuar?');
    if (!confirmed) {
        return;
    }
    zonesFromFile = defaultZonesFromFile.map((zone) => cloneZone(zone));
    clearZonesStorage();
    rebuildZonesOnMap();
    renderZonesList();
    resetZoneForm();
});

document.getElementById('zone-draw').addEventListener('click', (event) => {
    event.preventDefault();
    setZoneDrawMode(!drawingZone);
});


// ===== EXPORTAR / IMPORTAR JSON =====
document.getElementById('export-json').addEventListener('click', () => {
    const includeDefaults = document.getElementById('export-with-defaults').checked;
    const data = {
        custom: customLocations,
        connections: connections,
        zones: zonesFromFile,
        timestamp: new Date().toISOString()
    };
    if (includeDefaults) {
        data.defaults = defaultLocationsFromFile;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'CRIS-locais.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

document.getElementById('import-json').addEventListener('click', () => {
    document.getElementById('import-json-input').click();
});

document.getElementById('import-json-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyImportedData(data);
        } catch (error) {
            showNotification('Erro ao importar JSON');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
});

function resetMarkers() {
    allMarkers.forEach(markerData => markerData.marker.remove());
    allMarkers = [];
}

function rebuildMarkers() {
    resetMarkers();
    locations.forEach(location => createMarker(location, false));
    customLocations.forEach(location => createMarker(location, true));
    applyFilters();
    refreshConnectionOptions();
    renderConnectionList();
    if (showConnections) {
        updateConnections();
    }
}

function applyImportedData(data) {
    if (Array.isArray(data.defaults)) {
        const importedDefaults = {};
        data.defaults.forEach(loc => {
            if (loc.id) {
                importedDefaults[loc.id] = normalizeLocation({ ...loc });
            }
        });

        locations.forEach((loc, index) => {
            const incoming = importedDefaults[loc.id];
            if (incoming) {
                locations[index] = { ...loc, ...incoming };
            }
        });

        Object.keys(defaultEdits).forEach(key => delete defaultEdits[key]);
        Object.keys(importedDefaults).forEach(key => {
            const loc = importedDefaults[key];
            defaultEdits[key] = {
                type: loc.type,
                name: loc.name,
                description: loc.description,
                info: loc.info,
                threat: loc.threat
            };
        });
        saveDefaultEdits(defaultEdits);
    }

    if (Array.isArray(data.custom)) {
        customLocations = data.custom.map(loc => {
            if (!loc.id) {
                loc.id = Date.now().toString();
            }
            return normalizeLocation({ ...loc });
        });
        saveCustomLocations();
    }

    if (Array.isArray(data.connections)) {
        connections = data.connections.map((conn, index) => ({
            id: conn.id || `conn-${Date.now()}-${index}`,
            fromId: conn.fromId,
            toId: conn.toId,
            color: conn.color || '#00FF00',
            label: conn.label || 'Conexao'
        }));
    }

    if (Array.isArray(data.zones)) {
        zonesFromFile = data.zones.map((zone, index) => normalizeZone(zone, index));
        saveZonesToStorage(zonesFromFile);
        rebuildZonesOnMap();
        renderZonesList();
    }

    rebuildMarkers();
    showNotification('JSON importado com sucesso');
}

// ===== BOTÃO ADICIONAR LOCAL =====
const addButton = document.createElement('button');
addButton.id = 'add-location-btn';
addButton.innerHTML = 'Registrar Novo Sinal';
addButton.onclick = toggleAddMode;
document.body.appendChild(addButton);

// ===== MODAL DE FORMULÁRIO =====
const modal = document.createElement('div');
modal.id = 'location-modal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content">
        <h3 id="location-modal-title">Registro Rapido</h3>
        <form id="location-form">
            <label>Registrar</label>
            <div class="register-tabs" id="register-tabs">
                <button type="button" class="register-tab active" data-register-type="local">Local</button>
                <button type="button" class="register-tab" data-register-type="membrana">Membrana</button>
            </div>
            <input type="hidden" id="register-type" value="local" />

            <div id="location-panel" class="modal-panel">
                <div class="modal-panel-title">Local</div>

                <label>Tipo</label>
                <select id="location-type" required>
                    <option value="base">🏢 Bases</option>
                    <option value="casa">🏠 Casas</option>
                    <option value="loja">💼 Lojas/Contatos</option>
                    <option value="paranormal">⚠️ Registro do Paranormal</option>
                </select>
                
                <label>Nome</label>
                <input type="text" id="location-name" placeholder="Ex: Base Secundaria" required>

                <label>Nivel de Ameaca</label>
                <select id="threat-level" required>
                    <option value="1">Baixo</option>
                    <option value="2">Medio</option>
                    <option value="3">Alto</option>
                </select>
                
                <label>Descricao</label>
                <textarea id="location-description" placeholder="Resumo do sinal..."></textarea>
                
                <label>Dados Adicionais</label>
                <textarea id="location-info" placeholder="NEX, recursos, observacoes..."></textarea>

                <div class="membrane-toggle" id="local-membrane-toggle" role="button" aria-pressed="false" tabindex="0">
                    <span class="membrane-toggle-text">Estado da Membrana no local</span>
                    <span class="membrane-status" id="local-membrane-status">Desativada</span>
                </div>
                <div class="membrane-fields" id="local-membrane-fields">
                    <label>Estado da membrana</label>
                    <select id="local-membrane-state">
                        <option value="intacta">Intacta</option>
                        <option value="estavel" selected>Estavel</option>
                        <option value="danificada">Danificada</option>
                        <option value="arruinada">Arruinada</option>
                        <option value="rompida">Rompida</option>
                    </select>
                    <label>Raio da membrana (m)</label>
                    <input type="number" id="local-membrane-radius" min="100" max="50000" step="10" value="1000" />
                </div>
            </div>

            <div id="membrane-panel" class="modal-panel is-hidden">
                <div class="modal-panel-title">Membrana</div>
                <label>Nome da membrana</label>
                <input type="text" id="membrane-name" placeholder="Ponto de membrana" />
                <label>Estado da membrana</label>
                <select id="membrane-state">
                    <option value="intacta">Intacta</option>
                    <option value="estavel" selected>Estavel</option>
                    <option value="danificada">Danificada</option>
                    <option value="arruinada">Arruinada</option>
                    <option value="rompida">Rompida</option>
                </select>
                <label>Raio da membrana (m)</label>
                <input type="number" id="membrane-radius" min="100" max="50000" step="10" value="1000" />
            </div>
            
            <div class="modal-buttons">
                <button type="submit" class="btn-confirm" id="location-submit-btn">Salvar</button>
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
            </div>
        </form>
    </div>
`;
document.body.appendChild(modal);

function updateThreatField() {
    const typeValue = document.getElementById('location-type').value;
    const threatField = document.getElementById('threat-level');
    const isParanormal = typeValue === 'paranormal';
    threatField.disabled = !isParanormal;
    if (!isParanormal) {
        threatField.value = '1';
    }
}

function updateLocalMembraneStatus(isEnabled, isLinked) {
    const status = document.getElementById('local-membrane-status');
    const toggle = document.getElementById('local-membrane-toggle');
    if (!status) {
        return;
    }
    if (!isEnabled) {
        status.textContent = 'Desativada';
        if (toggle) {
            toggle.classList.remove('active');
            toggle.setAttribute('aria-pressed', 'false');
        }
        return;
    }
    status.textContent = isLinked ? 'Vinculada' : 'Ativa';
    if (toggle) {
        toggle.classList.add('active');
        toggle.setAttribute('aria-pressed', 'true');
    }
}

function toggleMembraneFields() {
    const fields = document.getElementById('local-membrane-fields');
    const enabled = fields ? !fields.classList.contains('is-hidden') : false;
    updateLocalMembraneStatus(enabled, false);
}

function setLocalMembraneEnabled(isEnabled, isLinked) {
    const fields = document.getElementById('local-membrane-fields');
    const state = document.getElementById('local-membrane-state');
    const radius = document.getElementById('local-membrane-radius');
    if (fields) {
        fields.classList.toggle('is-hidden', !isEnabled);
    }
    if (state) {
        state.disabled = !isEnabled;
    }
    if (radius) {
        radius.disabled = !isEnabled;
    }
    updateLocalMembraneStatus(isEnabled, isLinked);
}

function setPanelEnabled(panel, isEnabled) {
    const elements = panel.querySelectorAll('input, select, textarea, button');
    elements.forEach((element) => {
        element.disabled = !isEnabled;
    });
}

function setRegisterType(typeValue) {
    const registerType = document.getElementById('register-type');
    const tabs = document.querySelectorAll('.register-tab');
    if (registerType) {
        registerType.value = typeValue;
    }
    tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.registerType === typeValue);
    });
    updateRegisterTypePanel();
}

function setRegisterTabsLocked(isLocked) {
    const tabs = document.querySelectorAll('.register-tab');
    tabs.forEach((tab) => {
        tab.disabled = isLocked;
    });
}

function findZoneById(zoneId) {
    if (!zoneId) {
        return null;
    }
    return zonesFromFile.find((zone) => zone.id === zoneId) || null;
}

function updateRegisterTypePanel() {
    const registerType = document.getElementById('register-type');
    const locationPanel = document.getElementById('location-panel');
    const membranePanel = document.getElementById('membrane-panel');
    const isMembrane = registerType.value === 'membrana';

    locationPanel.classList.toggle('is-hidden', isMembrane);
    membranePanel.classList.toggle('is-hidden', !isMembrane);

    setPanelEnabled(locationPanel, !isMembrane);
    setPanelEnabled(membranePanel, isMembrane);

    if (isMembrane) {
        setLocalMembraneEnabled(false, false);
    }
}

function resetLocalMembraneForm() {
    const state = document.getElementById('local-membrane-state');
    const radius = document.getElementById('local-membrane-radius');
    if (state) {
        state.value = 'estavel';
    }
    if (radius) {
        radius.value = '1000';
    }
    setLocalMembraneEnabled(false, false);
}

function resetMembranePanelForm() {
    const name = document.getElementById('membrane-name');
    const state = document.getElementById('membrane-state');
    const radius = document.getElementById('membrane-radius');
    if (name) {
        name.value = '';
    }
    if (state) {
        state.value = 'estavel';
    }
    if (radius) {
        radius.value = '1000';
    }
}

function resetLocationForm() {
    const form = document.getElementById('location-form');
    if (form) {
        form.reset();
    }
    setRegisterType('local');
    setRegisterTabsLocked(false);
    updateThreatField();
    resetLocalMembraneForm();
    resetMembranePanelForm();
}

document.getElementById('location-type').addEventListener('change', updateThreatField);
document.querySelectorAll('.register-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        setRegisterType(tab.dataset.registerType);
    });
});
document.getElementById('local-membrane-toggle').addEventListener('click', () => {
    const fields = document.getElementById('local-membrane-fields');
    const isEnabled = fields ? fields.classList.contains('is-hidden') : true;
    setLocalMembraneEnabled(isEnabled, false);
});
document.getElementById('local-membrane-toggle').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }
    event.preventDefault();
    const fields = document.getElementById('local-membrane-fields');
    const isEnabled = fields ? fields.classList.contains('is-hidden') : true;
    setLocalMembraneEnabled(isEnabled, false);
});
updateRegisterTypePanel();
setLocalMembraneEnabled(false, false);

// ===== FUNÇÕES DE CONTROLE =====
function toggleAddMode() {
    addingLocation = !addingLocation;
    const btn = document.getElementById('add-location-btn');
    
    if (addingLocation) {
        btn.innerHTML = 'Cancelar Registro';
        btn.classList.add('active');
        map.getCanvas().style.cursor = 'crosshair';
        editingLocationId = null;
        setModalMode(false);
        resetLocationForm();
        showNotification('>>> Selecione localização no mapa');
    } else {
        btn.innerHTML = 'Registrar Novo Sinal';
        btn.classList.remove('active');
        map.getCanvas().style.cursor = '';
        if (tempMarker) {
            tempMarker.remove();
            tempMarker = null;
        }
    }
}

function closeModal() {
    document.getElementById('location-modal').style.display = 'none';
    if (tempMarker) {
        tempMarker.remove();
        tempMarker = null;
    }
    addingLocation = false;
    editingLocationId = null;
    setModalMode(false);
    resetLocationForm();
    document.getElementById('add-location-btn').innerHTML = 'Registrar Novo Sinal';
    document.getElementById('add-location-btn').classList.remove('active');
    map.getCanvas().style.cursor = '';
}

function stripLeadingIcon(fullName) {
    // Remove ícones emoji no início do nome (ex: "🏢 Base Principal" -> "Base Principal")
    const emojiRegex = /^[\p{Emoji}]\s+/u;
    return fullName.replace(emojiRegex, '');
}

function setModalMode(isEdit) {
    const title = document.getElementById('location-modal-title');
    const submitBtn = document.getElementById('location-submit-btn');
    if (isEdit) {
        title.textContent = 'Edicao Rapida';
        submitBtn.textContent = 'Atualizar';
    } else {
        title.textContent = 'Registro Rapido';
        submitBtn.textContent = 'Salvar';
    }
}

function editLocation(id) {
    const markerData = allMarkers.find(m => m.id === id);
    if (!markerData) {
        return;
    }

    setRegisterType('local');
    setRegisterTabsLocked(true);

    editingLocationId = id;
    addingLocation = false;

    document.getElementById('location-type').value = markerData.location.type;
    document.getElementById('location-name').value = stripLeadingIcon(markerData.location.name);
    document.getElementById('location-description').value = markerData.location.description;
    document.getElementById('location-info').value = markerData.location.info;
    document.getElementById('threat-level').value = String(markerData.location.threat || 1);
    updateThreatField();
    resetLocalMembraneForm();
    resetMembranePanelForm();

    const localMembraneEnabled = document.getElementById('local-membrane-enabled');
    const localMembraneState = document.getElementById('local-membrane-state');
    const localMembraneRadius = document.getElementById('local-membrane-radius');
    const membraneZoneId = markerData.location.membraneZoneId;
    const linkedZone = findZoneById(membraneZoneId);
    if (linkedZone && localMembraneState && localMembraneRadius) {
        localMembraneState.value = normalizeMembraneState(linkedZone.membraneState);
        localMembraneRadius.value = String(linkedZone.radiusMeters || 1000);
        setLocalMembraneEnabled(true, true);
    } else {
        setLocalMembraneEnabled(false, false);
    }

    setModalMode(true);
    document.getElementById('location-modal').style.display = 'flex';
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== CLICK NO MAPA PARA ADICIONAR =====
map.on('click', (e) => {
    // Verificar se clicou em uma zona
    const zoneFeatures = map.queryRenderedFeatures(e.point, { layers: Array.from(renderedZoneIds).map((id) => `${id}-fill`) });
    if (zoneFeatures.length > 0) {
        const feature = zoneFeatures[0];
        const zoneName = feature.properties.name || 'Zona';
        const zoneId = feature.properties.zoneId;
        
        // Mostrar menu contextual para a zona
        showZoneContextMenu(e.lngLat, zoneName, zoneId);
        return;
    }

    if (drawingZone) {
        // Apenas 1 clique para marcar o centro - não adiciona múltiplos
        if (zoneDrawCoords.length === 0) {
            zoneDrawCoords.push([e.lngLat.lng, e.lngLat.lat]);
            updateZoneDrawPreview();
            showNotification('✓ Centro marcado! Ajuste o raio e clique em "Finalizar Desenho"');
        } else {
            showNotification('⚠️ Centro já marcado. Para mudar, clique Cancelar primeiro.');
        }
        return;
    }

    if (addingLocation) {
        const coords = [e.lngLat.lng, e.lngLat.lat];
        
        // Remover marcador temporário anterior
        if (tempMarker) tempMarker.remove();
        
        // Criar marcador temporário
        const el = document.createElement('div');
        el.className = 'marker temp-marker';
        el.innerHTML = '📍';
        el.style.fontSize = '30px';
        
        tempMarker = new maplibregl.Marker(el)
            .setLngLat(coords)
            .addTo(map);
        
        // Armazenar coordenadas e abrir modal
        window.tempCoords = coords;
        document.getElementById('location-modal').style.display = 'flex';
    }
});

map.on('dblclick', (e) => {
    if (!drawingZone) {
        return;
    }
    e.preventDefault();
    setZoneDrawMode(false);
});

// ===== SUBMIT DO FORMULÁRIO =====
document.getElementById('location-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const registerType = document.getElementById('register-type').value;

    if (registerType === 'membrana') {
        const membraneNameRaw = document.getElementById('membrane-name').value.trim();
        const membraneState = normalizeMembraneState(document.getElementById('membrane-state').value);
        const membraneRadius = parseFloat(document.getElementById('membrane-radius').value);
        if (Number.isNaN(membraneRadius) || membraneRadius <= 0) {
            showNotification('Raio da membrana invalido');
            return;
        }
        if (!window.tempCoords) {
            showNotification('Selecione um ponto no mapa');
            return;
        }

        const membraneName = membraneNameRaw || 'Ponto de membrana';
        const zonePayload = normalizeZone({
            id: `zone-${Date.now()}`,
            name: membraneName,
            membraneState: membraneState,
            center: window.tempCoords,
            radiusMeters: membraneRadius,
            coordinates: createCirclePolygon(window.tempCoords, membraneRadius)
        }, zonesFromFile.length);

        zonesFromFile.push(zonePayload);
        saveZonesToStorage(zonesFromFile);
        rebuildZonesOnMap();
        renderZonesList();
        closeModal();
        showNotification('Membrana registrada com sucesso');
        return;
    }

    const type = document.getElementById('location-type').value;
    const name = document.getElementById('location-name').value.trim();
    const descriptionRaw = document.getElementById('location-description').value.trim();
    const infoRaw = document.getElementById('location-info').value.trim();
    const threatLevel = document.getElementById('threat-level').value;
    const threatValue = type === 'paranormal' ? parseInt(threatLevel, 10) : 0;

    if (!name) {
        showNotification('Informe o nome do sinal');
        return;
    }

    const description = descriptionRaw || 'Sem descricao';
    const info = infoRaw || 'Sem dados adicionais';

    const membraneFields = document.getElementById('local-membrane-fields');
    const membraneEnabled = membraneFields ? !membraneFields.classList.contains('is-hidden') : false;
    const membraneState = normalizeMembraneState(document.getElementById('local-membrane-state').value);
    const membraneRadius = parseFloat(document.getElementById('local-membrane-radius').value);
    if (membraneEnabled && (Number.isNaN(membraneRadius) || membraneRadius <= 0)) {
        showNotification('Raio da membrana invalido');
        return;
    }

    if (editingLocationId) {
        const markerData = allMarkers.find(m => m.id === editingLocationId);
        if (!markerData) {
            closeModal();
            return;
        }

        let membraneAction = null;
        let membraneZoneId = markerData.location.membraneZoneId || null;

        const updatedLocation = {
            ...markerData.location,
            type: type,
            name: name,
            description: description,
            info: info,
            threat: threatValue
        };

        if (membraneEnabled) {
            const existingZone = findZoneById(membraneZoneId);
            const zonePayload = normalizeZone({
                id: existingZone ? existingZone.id : `zone-${Date.now()}`,
                name: `Membrana - ${name}`,
                membraneState: membraneState,
                center: updatedLocation.coords,
                radiusMeters: membraneRadius,
                coordinates: createCirclePolygon(updatedLocation.coords, membraneRadius)
            }, zonesFromFile.length);

            if (existingZone) {
                zonesFromFile = zonesFromFile.map((zone) => zone.id === existingZone.id ? zonePayload : zone);
                membraneAction = 'updated';
            } else {
                zonesFromFile.push(zonePayload);
                membraneZoneId = zonePayload.id;
                membraneAction = 'created';
            }
        } else if (membraneZoneId) {
            const existingZone = findZoneById(membraneZoneId);
            if (existingZone) {
                const shouldRemove = confirm('Remover a membrana vinculada a este local?');
                if (shouldRemove) {
                    zonesFromFile = zonesFromFile.filter((zone) => zone.id !== membraneZoneId);
                    membraneAction = 'removed';
                } else {
                    membraneAction = 'unlinked';
                }
            }
            membraneZoneId = null;
        }

        updatedLocation.membraneZoneId = membraneZoneId;

        const customIndex = customLocations.findIndex(loc => loc.id === editingLocationId);
        if (customIndex !== -1) {
            customLocations[customIndex] = updatedLocation;
            saveCustomLocations();
        } else {
            const locationIndex = locations.findIndex(loc => loc.id === editingLocationId);
            if (locationIndex !== -1) {
                locations[locationIndex] = updatedLocation;
                defaultEdits[editingLocationId] = {
                    type: updatedLocation.type,
                    name: updatedLocation.name,
                    description: updatedLocation.description,
                    info: updatedLocation.info,
                    threat: updatedLocation.threat,
                    membraneZoneId: updatedLocation.membraneZoneId
                };
                saveDefaultEdits(defaultEdits);
            }
        }

        markerData.marker.remove();
        allMarkers = allMarkers.filter(m => m.id !== editingLocationId);
        createMarker(updatedLocation);
        refreshConnectionOptions();

        if (membraneAction) {
            saveZonesToStorage(zonesFromFile);
            rebuildZonesOnMap();
            renderZonesList();
        }

        closeModal();
        showNotification('Registro atualizado com sucesso');
        if (membraneAction === 'updated') {
            showNotification('Membrana atualizada');
        } else if (membraneAction === 'created') {
            showNotification('Membrana criada');
        } else if (membraneAction === 'removed') {
            showNotification('Membrana removida');
        } else if (membraneAction === 'unlinked') {
            showNotification('Membrana mantida (local sem vinculo)');
        }
        return;
    }

    if (!window.tempCoords) {
        showNotification('Selecione um ponto no mapa');
        return;
    }

    const newLocation = {
        id: `loc-${Date.now()}`,
        type: type,
        name: name,
        coords: window.tempCoords,
        description: description,
        info: info,
        threat: threatValue,
        membraneZoneId: null
    };
    
    customLocations.push(newLocation);
    saveCustomLocations();
    createMarker(newLocation);
    refreshConnectionOptions();

    if (membraneEnabled) {
        const zonePayload = normalizeZone({
            id: `zone-${Date.now()}`,
            name: `Membrana - ${name}`,
            membraneState: membraneState,
            center: newLocation.coords,
            radiusMeters: membraneRadius,
            coordinates: createCirclePolygon(newLocation.coords, membraneRadius)
        }, zonesFromFile.length);
        zonesFromFile.push(zonePayload);
        newLocation.membraneZoneId = zonePayload.id;
        saveZonesToStorage(zonesFromFile);
        rebuildZonesOnMap();
        renderZonesList();
    }
    
    closeModal();
    showNotification('Sinal registrado com sucesso');
});

// Tornar deleteLocation e closeModal globais
window.deleteLocation = deleteLocation;
window.closeModal = closeModal;
window.editLocation = editLocation;
