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

// ===== ESTILOS DOS MARCADORES =====
const markerStyles = {
    'base': { color: '#00FF00', scale: 1.2 },
    'casa': { color: '#4169E1', scale: 1.0 },
    'loja': { color: '#FFD700', scale: 1.0 },
    'paranormal': { color: '#FF6347', scale: 1.1 }
};

const markerIcons = {
    base: '🏢',
    casa: '🏠',
    loja: '💼',
    paranormal: '⚠️'
};

function getMarkerIcon(type) {
    return markerIcons[type] || '📍';
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
    
    return {
        id: zone.id || `zone-${index}`,
        name: zone.name || 'Zona de perigo',
        coordinates: coordinates,
        center: zone.center,
        radiusMeters: zone.radiusMeters,
        fillColor: zone.fillColor || '#DC143C',
        fillOpacity: typeof zone.fillOpacity === 'number' ? zone.fillOpacity : 0.15,
        lineColor: zone.lineColor || zone.fillColor || '#DC143C',
        lineWidth: typeof zone.lineWidth === 'number' ? zone.lineWidth : 2,
        lineDasharray: Array.isArray(zone.lineDasharray) ? zone.lineDasharray : [4, 2]
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

        if (Array.isArray(data.connections) && data.connections.length > 0) {
            connections = data.connections.map((conn, index) => ({
                id: conn.id || `conn-${Date.now()}-${index}`,
                fromId: conn.fromId,
                toId: conn.toId,
                color: conn.color || '#00FF00',
                label: conn.label || 'Conexao'
            }));
        } else {
            connections = [...defaultConnections];
        }

        defaultZonesFromFile = Array.isArray(defaultData.zones)
            ? defaultData.zones.map((zone, index) => normalizeZone(zone, index))
            : [];

        const storedZones = loadZonesFromStorage();
        zonesFromFile = storedZones
            ? storedZones.map((zone) => cloneZone(zone))
            : defaultZonesFromFile.map((zone) => cloneZone(zone));
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
    zonesFromFile.forEach((zone) => {
        if (!Array.isArray(zone.coordinates)) {
            return;
        }

        const sourceId = `${zone.id}-source`;
        const fillId = `${zone.id}-fill`;
        const borderId = `${zone.id}-border`;

        if (map.getSource(sourceId)) {
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

        map.addLayer({
            'id': fillId,
            'type': 'fill',
            'source': sourceId,
            'paint': {
                'fill-color': zone.fillColor,
                'fill-opacity': zone.fillOpacity
            }
        });

        map.addLayer({
            'id': borderId,
            'type': 'line',
            'source': sourceId,
            'paint': {
                'line-color': zone.lineColor,
                'line-width': zone.lineWidth,
                'line-dasharray': zone.lineDasharray
            }
        });

        renderedZoneIds.add(zone.id);
    });
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
            document.getElementById('zone-fill-color').value = zone.fillColor || '#DC143C';
            document.getElementById('zone-fill-opacity').value = String(zone.fillOpacity ?? 0.15);
            document.getElementById('zone-line-color').value = zone.lineColor || zone.fillColor || '#DC143C';
            document.getElementById('zone-line-width').value = String(zone.lineWidth ?? 2);
            document.getElementById('zone-line-dasharray').value = JSON.stringify(zone.lineDasharray || [4, 2]);

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

    const featureCollection = {
        type: 'FeatureCollection',
        features: []
    };

    // Se tem centro e raio, desenha círculo
    if (zoneDrawCoords.length === 1) {
        const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 0;
        if (radiusMeters > 0) {
            const circleCoords = createCirclePolygon(zoneDrawCoords[0], radiusMeters);
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
                'fill-color': '#ffcc00',
                'fill-opacity': 0.15
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
                'circle-color': '#ffcc00',
                'circle-opacity': 1
            }
        });
    } else {
        map.getSource(zoneDrawSourceId).setData(featureCollection);
    }
}

function setZoneDrawMode(isActive) {
    drawingZone = isActive;
    const drawBtn = document.getElementById('zone-draw');
    const finishBtn = document.getElementById('zone-draw-finish');
    const cancelBtn = document.getElementById('zone-draw-cancel');
    const isEditing = editingZoneId !== null;

    if (drawBtn) {
        drawBtn.classList.toggle('active', isActive);
        drawBtn.textContent = isEditing ? 'Edição Ativa' : (isActive ? 'Desenho Ativo' : 'Desenhar Zona');
    }

    if (finishBtn) {
        finishBtn.disabled = !isActive;
        finishBtn.textContent = isEditing ? 'Confirmar Edição' : 'Finalizar Zona';
    }

    if (cancelBtn) {
        cancelBtn.disabled = !isActive;
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
        map.getCanvas().style.cursor = '';
        map.doubleClickZoom.enable();
    }
}

function finalizeZoneDraw() {
    if (!drawingZone) {
        return;
    }
    if (zoneDrawCoords.length !== 1) {
        showNotification('Marque apenas uma vez para o centro da zona');
        return;
    }
    const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 0;
    if (radiusMeters <= 0) {
        showNotification('Ajuste o raio para um valor maior que 0 m');
        return;
    }
    const center = zoneDrawCoords[0];
    const circleCoords = createCirclePolygon(center, radiusMeters);
    document.getElementById('zone-coordinates').value = JSON.stringify(circleCoords);
    // Guardar referência do centro para edição posterior
    window.zoneCenter = center;
    setZoneDrawMode(false);
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
    
    // Criar elemento customizado do marcador
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = getMarkerIcon(location.type);
    el.style.fontSize = `${24 * style.scale}px`;
    el.style.cursor = 'pointer';
    el.style.filter = 'drop-shadow(0 0 8px rgba(0,0,0,0.8))';
    
    // Criar popup com informações
    const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(buildPopupHtml(location));
    
    // Adicionar marcador ao mapa
    const marker = new maplibregl.Marker(el)
        .setLngLat(location.coords)
        .setPopup(popup)
        .addTo(map);
    
    // Efeito hover
    el.addEventListener('mouseenter', () => {
        if (!hoverFilter) {
            el.style.transform = 'scale(1.2)';
            el.style.filter = `drop-shadow(0 0 12px ${style.color})`;
        }
    });
    
    el.addEventListener('mouseleave', () => {
        if (!hoverFilter) {
            el.style.transform = 'scale(1)';
            el.style.filter = 'drop-shadow(0 0 8px rgba(0,0,0,0.8))';
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
    refreshConnectionOptions();
    renderConnectionList();
    renderZonesList();
    if (showConnections) {
        updateConnections();
    }
}

// ===== ADICIONAR MARCADORES AO MAPA =====
map.on('load', async function() {
    await loadLocationsFromJson();

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

    addZonesToMap();
    updateConnections();
    
    // Renderizar lista de zonas no painel
    renderZonesList();
    
    document.getElementById('toggle-connections').classList.add('active');
    document.getElementById('toggle-connections').innerHTML = '🔗 Ocultar Conexoes';
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
            <div class="legend-item legend-filter" data-filter="base"><span style="color: #00FF00">🏢</span> Bases</div>
            <div class="legend-item legend-filter" data-filter="casa"><span style="color: #4169E1">🏠</span> Casas</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">PONTOS DE SUPORTE</div>
            <div class="legend-item legend-filter" data-filter="loja"><span style="color: #FFD700">💼</span> Lojas/Contatos</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">REGISTRO DO PARANORMAL</div>
            <div class="legend-item legend-filter" data-filter="paranormal"><span style="color: #FF6347">⚠️</span> Manifestacoes</div>
        </div>
        <div class="legend-section">
            <div class="legend-title">TIPOS DE CONEXÃO</div>
            <div class="legend-item"><span style="background: #4169E1; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Investigacao Ativa</div>
            <div class="legend-item"><span style="background: #00FF00; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Monitoramento</div>
            <div class="legend-item"><span style="background: #FFD700; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Fonte de Informacao</div>
            <div class="legend-item"><span style="background: #DC143C; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px;"></span> Possivel Relacao</div>
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
    <div class="filter-title">ZONAS DE PERIGO</div>
    <div class="zone-list" id="zone-list"></div>
    <div class="zone-form">
        <div id="zone-editing-indicator" class="zone-editing-indicator" style="display: none; color: #FFD700; margin-bottom: 8px; font-weight: bold;">
            ✎ Editando: <span id="zone-editing-name"></span>
        </div>
        <label for="zone-name">Nome</label>
        <input type="text" id="zone-name" placeholder="Zona de perigo" />
        <div class="zone-draw-actions">
            <button class="data-btn" id="zone-draw">Desenhar Zona</button>
            <button class="data-btn" id="zone-draw-finish" disabled>Finalizar Desenho</button>
            <button class="data-btn" id="zone-draw-cancel" disabled>Cancelar Desenho</button>
        </div>
        <label for="zone-radius">Raio (m)</label>
        <input type="number" id="zone-radius" min="100" max="50000" step="10" value="1000" />
        <textarea id="zone-coordinates" class="zone-coordinates-hidden" aria-hidden="true"></textarea>
        <label for="zone-fill-color">Cor preenchimento</label>
        <input type="color" id="zone-fill-color" value="#DC143C" />
        <label for="zone-fill-opacity">Opacidade (0 a 1)</label>
        <input type="number" id="zone-fill-opacity" min="0" max="1" step="0.05" value="0.15" />
        <label for="zone-line-color">Cor borda</label>
        <input type="color" id="zone-line-color" value="#DC143C" />
        <label for="zone-line-width">Espessura borda</label>
        <input type="number" id="zone-line-width" min="1" max="10" step="1" value="2" />
        <label for="zone-line-dasharray">Tracejado (JSON)</label>
        <input type="text" id="zone-line-dasharray" value="[4,2]" />
        <button class="data-btn" id="zone-save">Salvar Zona</button>
        <button class="data-btn" id="zone-reset">Restaurar do Arquivo</button>
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
    <button class="panel-btn" data-panel="zones">Mostrar Zonas</button>
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

panelControls.querySelector('[data-panel="zones"]').addEventListener('click', (event) => {
    togglePanel(zonesContainer, event.currentTarget, 'Zonas');
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
                markerData.element.style.cssText = `
                    opacity: 1 !important;
                    filter: drop-shadow(0 0 25px rgba(255, 255, 0, 1)) drop-shadow(0 0 45px rgba(255, 200, 0, 0.8)) !important;
                    transform: scale(1.3) !important;
                    transition: all 0.2s ease !important;
                    font-size: ${24 * (markerStyles[markerData.type]?.scale || 1)}px !important;
                    cursor: pointer !important;
                `;
            } else if (isHovering && !isMatch) {
                // DIM
                markerData.element.style.cssText = `
                    opacity: 0.15 !important;
                    filter: grayscale(1) drop-shadow(0 0 2px rgba(0,0,0,0.3)) !important;
                    transform: scale(0.8) !important;
                    transition: all 0.2s ease !important;
                    font-size: ${24 * (markerStyles[markerData.type]?.scale || 1)}px !important;
                    cursor: pointer !important;
                `;
            } else {
                // RESTAURAR PADRÃO
                const style = markerStyles[markerData.type] || { color: '#00FF00', scale: 1.0 };
                markerData.element.style.cssText = `
                    font-size: ${24 * style.scale}px !important;
                    cursor: pointer !important;
                    filter: drop-shadow(0 0 8px rgba(0,0,0,0.8)) !important;
                    opacity: 1 !important;
                    transform: scale(1) !important;
                    transition: all 0.2s ease !important;
                `;
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
    document.getElementById('zone-fill-color').value = '#DC143C';
    document.getElementById('zone-fill-opacity').value = '0.15';
    document.getElementById('zone-line-color').value = '#DC143C';
    document.getElementById('zone-line-width').value = '2';
    document.getElementById('zone-line-dasharray').value = '[4,2]';
    
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
        return `
            <div class="zone-item">
                <span class="zone-color" style="background:${zone.fillColor}"></span>
                <span class="zone-text">${safeName}</span>
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
            document.getElementById('zone-fill-color').value = zone.fillColor || '#DC143C';
            document.getElementById('zone-fill-opacity').value = String(zone.fillOpacity ?? 0.15);
            document.getElementById('zone-line-color').value = zone.lineColor || zone.fillColor || '#DC143C';
            document.getElementById('zone-line-width').value = String(zone.lineWidth ?? 2);
            document.getElementById('zone-line-dasharray').value = JSON.stringify(zone.lineDasharray || [4, 2]);
            
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

document.getElementById('zone-save').addEventListener('click', (event) => {
    event.preventDefault();
    const name = document.getElementById('zone-name').value.trim() || 'Zona de perigo';
    const coordsRaw = document.getElementById('zone-coordinates').value.trim();
    const radiusMeters = parseFloat(document.getElementById('zone-radius').value) || 1000;
    const fillColor = document.getElementById('zone-fill-color').value || '#DC143C';
    const fillOpacity = parseFloat(document.getElementById('zone-fill-opacity').value);
    const lineColor = document.getElementById('zone-line-color').value || '#DC143C';
    const lineWidth = parseFloat(document.getElementById('zone-line-width').value);
    const dashRaw = document.getElementById('zone-line-dasharray').value.trim();

    if (!coordsRaw) {
        showNotification('Informe as coordenadas da zona');
        return;
    }

    let coordinates;
    try {
        coordinates = JSON.parse(coordsRaw);
    } catch (error) {
        showNotification('Coordenadas invalidas');
        return;
    }

    if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
        showNotification('Formato de coordenadas invalido');
        return;
    }

    if (Number.isNaN(fillOpacity) || fillOpacity < 0 || fillOpacity > 1) {
        showNotification('Opacidade invalida');
        return;
    }

    if (Number.isNaN(lineWidth) || lineWidth <= 0) {
        showNotification('Espessura invalida');
        return;
    }

    let lineDasharray = [4, 2];
    if (dashRaw) {
        try {
            const parsedDash = JSON.parse(dashRaw);
            if (Array.isArray(parsedDash) && parsedDash.length >= 2) {
                lineDasharray = parsedDash.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
            }
        } catch (error) {
            showNotification('Tracejado invalido');
            return;
        }
    }

    const zonePayload = normalizeZone({
        id: editingZoneId || `zone-${Date.now()}`,
        name,
        coordinates,
        radiusMeters,
        center: window.zoneCenter || (coordinates[0] ? coordinates[0][0] : null),
        fillColor,
        fillOpacity,
        lineColor,
        lineWidth,
        lineDasharray
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

document.getElementById('zone-draw-finish').addEventListener('click', (event) => {
    event.preventDefault();
    finalizeZoneDraw();
});

document.getElementById('zone-draw-cancel').addEventListener('click', (event) => {
    event.preventDefault();
    zoneDrawCoords = [];
    window.zoneCenter = null;
    setZoneDrawMode(false);
    if (editingZoneId) {
        resetZoneForm();
        showNotification('Edição cancelada');
    }
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
        saveLocations();
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
        <h3 id="location-modal-title">Registro de Novo Sinal</h3>
        <form id="location-form">
            <label>Tipo de Sinal:</label>
            <select id="location-type" required>
                <option value="base">🏢 Bases</option>
                <option value="casa">🏠 Casas</option>
                <option value="loja">💼 Lojas/Contatos</option>
                <option value="paranormal">⚠️ Registro do Paranormal</option>
            </select>

            <label>Nivel de Ameaca:</label>
            <select id="threat-level" required>
                <option value="1">Baixo</option>
                <option value="2">Medio</option>
                <option value="3">Alto</option>
            </select>
            
            <label>Designação:</label>
            <input type="text" id="location-name" placeholder="Ex: Base Secundária" required>
            
            <label>Descrição:</label>
            <textarea id="location-description" placeholder="Descrição detalhada do sinal detectado..." required></textarea>
            
            <label>Dados Adicionais:</label>
            <textarea id="location-info" placeholder="NEX, nível de ameaça, recursos disponíveis..." required></textarea>
            
            <div class="modal-buttons">
                <button type="submit" class="btn-confirm" id="location-submit-btn">Confirmar</button>
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

document.getElementById('location-type').addEventListener('change', updateThreatField);

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
        updateThreatField();
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
    document.getElementById('add-location-btn').innerHTML = 'Registrar Novo Sinal';
    document.getElementById('add-location-btn').classList.remove('active');
    map.getCanvas().style.cursor = '';
}

function stripLeadingIcon(fullName) {
    const icons = Object.values(markerIcons);
    const match = icons.find(icon => fullName.startsWith(`${icon} `));
    return match ? fullName.slice(match.length + 1) : fullName;
}

function setModalMode(isEdit) {
    const title = document.getElementById('location-modal-title');
    const submitBtn = document.getElementById('location-submit-btn');
    if (isEdit) {
        title.textContent = 'Editar Registro';
        submitBtn.textContent = 'Atualizar';
    } else {
        title.textContent = 'Registro de Novo Sinal';
        submitBtn.textContent = 'Confirmar';
    }
}

function editLocation(id) {
    const markerData = allMarkers.find(m => m.id === id);
    if (!markerData) {
        return;
    }

    editingLocationId = id;
    addingLocation = false;

    document.getElementById('location-type').value = markerData.location.type;
    document.getElementById('location-name').value = stripLeadingIcon(markerData.location.name);
    document.getElementById('location-description').value = markerData.location.description;
    document.getElementById('location-info').value = markerData.location.info;
    document.getElementById('threat-level').value = String(markerData.location.threat || 1);
    updateThreatField();

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
    finalizeZoneDraw();
});

// ===== SUBMIT DO FORMULÁRIO =====
document.getElementById('location-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const type = document.getElementById('location-type').value;
    const name = document.getElementById('location-name').value;
    const description = document.getElementById('location-description').value;
    const info = document.getElementById('location-info').value;
    const threatLevel = document.getElementById('threat-level').value;
    const threatValue = type === 'paranormal' ? parseInt(threatLevel, 10) : 0;
    
    if (editingLocationId) {
        const markerData = allMarkers.find(m => m.id === editingLocationId);
        if (!markerData) {
            closeModal();
            return;
        }

        const updatedLocation = {
            ...markerData.location,
            type: type,
            name: name,
            description: description,
            info: info,
            threat: threatValue
        };

        const locationIndex = locations.findIndex(loc => loc.id === editingLocationId);
        if (locationIndex !== -1) {
            locations[locationIndex] = updatedLocation;
            saveLocations();
        }

        markerData.marker.remove();
        allMarkers = allMarkers.filter(m => m.id !== editingLocationId);
        createMarker(updatedLocation);
        refreshConnectionOptions();

        document.getElementById('location-form').reset();
        closeModal();
        showNotification('Registro atualizado com sucesso');
        return;
    }

    const newLocation = {
        id: `loc-${Date.now()}`,
        type: type,
        name: name,
        coords: window.tempCoords,
        description: description,
        info: info,
        threat: threatValue
    };
    
    locations.push(newLocation);
    saveLocations();
    createMarker(newLocation);
    refreshConnectionOptions();
    
    // Limpar e fechar
    document.getElementById('location-form').reset();
    closeModal();
    showNotification('Sinal registrado com sucesso');
});

// Tornar deleteLocation e closeModal globais
window.deleteLocation = deleteLocation;
window.closeModal = closeModal;
window.editLocation = editLocation;
