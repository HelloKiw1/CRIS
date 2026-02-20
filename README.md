# C.R.I.S. - Central de Rastreamento e Investigação de Sinais

## 👻 Sobre o Projeto

**C.R.I.S.** é um aplicativo de cartografia paranormal baseado no universo de **Ordem Paranormal**, criado por Rafael Lange (Cellbit). O sistema funciona como um hub de investigação para rastrear e mapear fenômenos sobrenaturais, sinistros e entidades paranormais.

Desenvolvido para investigadores, pesquisadores paranormais e fãs de Ordem Paranormal, C.R.I.S. permite documentar, organizar e visualizar padrões de atividade sobrenatural em mapas interativos.

---

## 🛰️ Funcionalidades Principais

### 🗺️ **Mapeamento Interativo**
- Mapa em tempo real com MapLibre GL 3.3.1
- Visualização de locais de investigação paranormal
- Zoom, navegação e exploração territorial
- Identificação de hotspots de atividade sobrenatural

### 📍 **Registro de Evidências (Locais)**
- Adicione pontos de investigação com:
  - Nome do local/caso
  - Descrição detalhada
  - Categoria de sinistro
  - Coordenadas precisas
- **Categorias Disponíveis:**
  - 🪦 Cemitério
  - 🏚️ Casa Assombrada
  - ⛪ Igreja
  - 🌀 Portal Paranormal
  - 👁️ Avistamento
  - 📿 Artefato Sobrenatural
  - ❓ Outro

### 🔴 **Zonas de Investigação**
- Defina **zonas circulares de risco** com raio em metros
- Desenhe diretamente no mapa (click para centro, ajuste raio)
- **Clique em uma zona** para abrir menu com opções:
  - ✏️ Editar zona (ajuste raio, cores, propriedades)
  - 🗑️ Deletar zona
- Personalização completa:
  - Cores de preenchimento e borda
  - Opacidade e espessura
  - Padrões de tracejado

### 🔗 **Mapeamento de Conexões**
- Conecte locais relacionados (evidência de padrões)
- Visualize relacionamentos entre casos
- Labels customizados para conexões
- Cores personalizáveis por tipo de relação
- Alternar visualização de conexões

### 🎨 **Customização Visual**
- Cores ajustáveis para cada zona
- Opacidade de preenchimento (0-100%)
- Espessura de borda customizável
- Padrões de tracejado para bordas

### 💾 **Persistência de Arquivos**
- Salve automaticamente em `cris-locais.json`
- Carregue configuração padrão de `CRIS-locaisdefault.json`
- Importe/exporte dados em JSON
- Histórico de investigações preservado

### 🔍 **Filtros e Análise**
- Filtre por categoria de sinistro
- Hover highlights em marcadores
- Visualização seletiva de conexões
- Mostrar/ocultar dados padrão do arquivo

---

## 🚀 Como Usar

### 1. **Adicionar um Local de Investigação**
   - Clique no mapa ou use o painel lateral
   - Preencha nome, descrição, categoria e coordenadas
   - Salve o registro

### 2. **Criar uma Zona de Investigação**
   - Clique em **"Desenhar Zona"**
   - Clique UMA VEZ no mapa para marcar o **centro**
   - Ajuste o raio (100m - 50.000m) com o slider
   - Veja a zona em tempo real
   - Clique **"Finalizar Zona"** para salvar

### 3. **Editar uma Zona Existente**
   - Clique diretamente na zona no mapa
   - Selecione **"✏️ Editar"** no menu
   - Ajuste o raio com o slider
   - Customize cores, opacidade e borda
   - Clique **"Confirmar Edição"** para salvar

### 4. **Conectar Locais**
   - No painel "Conexões", selecione origem e destino
   - Adicione label descritivo (opcional)
   - Escolha cor da conexão
   - Visualize linha conectando os locais

### 5. **Filtrar Investigações**
   - Selecione categorias no painel lateral
   - Apenas locais correspondentes serão exibidos
   - Use hover para destacar marcadores

---

## 📊 Estrutura de Dados

### Locais (Registros)
```json
{
  "id": "local-001",
  "name": "Casa Assombrada da Avenida X",
  "description": "Avistamentos frequentes, barulhos noturnos",
  "category": "Casa Assombrada",
  "lat": -10.2025,
  "lng": -48.31,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Zonas
```json
{
  "id": "zona-perigo-extremo",
  "name": "Zona de Perigo Extremo",
  "center": [-48.31, -10.2025],
  "radiusMeters": 1500,
  "coordinates": [[...64+ pontos...]], // Polígono circular
  "fillColor": "#DC143C",
  "fillOpacity": 0.15,
  "lineColor": "#DC143C",
  "lineWidth": 2,
  "lineDasharray": [4, 2]
}
```

### Conexões
```json
{
  "id": "conn-12345",
  "fromId": "local-001",
  "toId": "local-002",
  "label": "Evidência de padrão",
  "color": "#00FF00"
}
```

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Propósito |
|---|---|---|
| **MapLibre GL** | 3.3.1 | Renderização de mapas |
| **JavaScript** | ES6+ | Lógica frontend |
| **GeoJSON** | - | Formato de dados geográficos |
| **JSON** | - | Persistência local |
| **HTML5 Canvas** | - | Renderização interativa |

---

## 📁 Estrutura de Arquivos

```
CRIS/
├── criss.html              # Interface principal
├── criss.js                # Lógica da aplicação
├── criss.css               # Estilos (tema paranormal)
├── cris-locais.json        # Dados persistentes (usuário)
├── CRIS-locaisdefault.json # Dados padrão (referência)
└── README.md               # Esta documentação
```

---

## 🔐 Dados Privados

- ✅ Todos os dados são armazenados **localmente** no seu navegador
- ✅ Nenhuma informação é enviada para servidores
- ✅ Seu histórico de investigação permanece privado
- ✅ Exporte quando necessário compartilhar

---

## 🎯 Casos de Uso

- 📋 Documentar investigações paranormais
- 🗺️ Mapear hotspots de atividade sobrenatural
- 🔗 Identificar padrões entre casos
- 📊 Analisar zonas de risco paranormal
- 👥 Compartilhar descobertas com outros investigadores

---

## 👻 Créditos

Baseado no universo de **Ordem Paranormal**, criado por **Rafael Lange (Cellbit)**.
- Campanhas disponíveis em: https://www.twitch.tv/cellbit
- Wiki oficial: https://ordemparanormal.fandom.com/

---

## 📝 Licença

Este é um projeto fã baseado em Ordem Paranormal para fins de pesquisa e entretenimento.

---

**Para investigar o paranormal com precisão cartográfica.** 👻🗺️✨
