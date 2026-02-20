# C.R.I.S. - Cartografia de Registros de Investigação Sobrenatural

## O que é C.R.I.S.?

**C.R.I.S.** é um aplicativo web de mapeamento interativo especializado em investigação paranormal e análise sobrenatural. Permite registrar, organizar e visualizar locais de interesse paranormal em um mapa interativo, com suporte para zonas, conexões entre locais e filtragem avançada de dados.

## Funcionalidades Principais

### 🗺️ **Mapeamento Interativo**
- Visualização em tempo real de locais e zonas em mapa MapLibre GL
- Integração com dados geográficos em tempo real
- Zoom e navegação intuitiva

### 📍 **Gerenciamento de Locais (Registros)**
- Adicione locais de investigação com nome, descrição e categoria
- Categorize por tipo: Cemitério, Casa Assombrada, Igreja, Portal, Avistamento, Artefato, Outro
- Filtro por categoria para focar investigações específicas
- Editar e remover registros a qualquer momento

### 🔴 **Gerenciamento de Zonas Circulares**
- Crie zonas com **raio em metros** (100m - 50.000m)
- Desenhe zonas no mapa clicando para marcar o centro e ajustando o raio
- **Clique em uma zona** para abrir menu contextual com opções de editar/deletar
- Personalize cores, opacidade e estilo de borda das zonas
- Persista zonas em arquivo JSON

### 🔗 **Conexões Entre Locais**
- Estabeleça conexões (relações) entre diferentes locais de investigação
- Visualize relacionamentos com linhas coloridas no mapa
- Adicione labels para explicar o tipo de conexão
- Alternar visualização de conexões

### 🎨 **Customização Visual**
- Cores personalizáveis para zonas (fill e borda)
- Opacidade e espessura de linhas ajustáveis
- Padrões de tracejado para bordas (solid, dashed, etc.)

### 💾 **Persistência de Dados**
- Salve automaticamente em arquivo `cris-locais.json`
- Carregue dados padrão de `CRIS-locaisdefault.json`
- Importe e exporte dados em JSON

### 🔍 **Filtros e Visualização**
- Filtre locais por categoria
- Hover highlights para identificar marcadores
- Visualização de conexões relacionadas

## Como Usar

1. **Adicionar Local**: Clique em um local no mapa ou use o painel de adição
2. **Criar Zona**: Clique em "Desenhar Zona", marque o centro, ajuste o raio e finalize
3. **Editar Zona**: Clique diretamente na zona no mapa para abrir o menu
4. **Conectar Locais**: Use o painel de conexões para criar relacionamentos
5. **Filtrar**: Selecione categorias para visualizar apenas investigações específicas

## Tecnologias

- **MapLibre GL 3.3.1** - Renderização de mapas
- **JavaScript Vanilla** - Lógica frontend
- **GeoJSON** - Formato de dados geográficos
- **JSON** - Persistência local

---

**Para investigar o paranormal com precisão cartográfica.** 👻🗺️
