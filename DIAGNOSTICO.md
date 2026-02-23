# 🔍 Diagnóstico de Carregamento de Dados - CRIS

## 📋 Estrutura de Arquivos

### Arquivo Padrão: `CRIS-locaisdefault.json` ✅
- **Localização**: Raiz do projeto
- **Conteúdo**:
  - `defaults`: 1 local (id: loc-1771879399100, name: "asd")
  - `zones`: 2 zonas (zone-1771879369191 e zone-1771879399103)
  - `connections`: array vazio

### Arquivo Customizado: `CRIS-locais.json` ⚠️
- **Localização**: Raiz do projeto
- **Conteúdo**: Completamente vazio
  - `custom`: []
  - `zones`: []
  - `connections`: []
  - É usado para armazenar customizações feitas pela aplicação

---

## 🔗 Fluxo de Carregamento de Dados

### 1️⃣ **Locais (Locations)**
```
CRIS-locaisdefault.json (defaults)
        ↓
   Normaliza
        ↓
  locations[] (1 local)
```
**Status**: ✅ Carregando 1 local do arquivo padrão

---

### 2️⃣ **Zonas (Zones)** - ⚠️ CRÍTICO

```
CRIS-locaisdefault.json (zones)
        ↓
   Normaliza
        ↓
  defaultZonesFromFile[] (2 zonas)
        ↓
   VERIFICA LocalStorage
        ↓
   SE ENCONTRAR → USA ISSO ❌ PROBLEMA!
   SE NÃO → USA defaultZonesFromFile ✅
        ↓
  zonesFromFile[] (final)
```

**⚠️ PROBLEMA IDENTIFICADO:**
- Se houver zonas antigas armazenadas em LocalStorage, a aplicação as carrega em vez dos dados padrão
- Isso sobrescreve completamente as 2 zonas de CRIS-locaisdefault.json

---

### 3️⃣ **Conexões (Connections)**
```
CRIS-locaisdefault.json (connections)
        ↓
   Normaliza
        ↓
  defaultConnections[] (0 conexões)
        ↓
   VERIFICA CRIS-locais.json
        ↓
   SE ENCONTRAR → USA ISSO
   SE NÃO → USA defaultConnections
        ↓
  connections[] (final)
```
**Status**: ✅ Nenhuma conexão (arrays vazios)

---

## 🛠️ Como Diagnosticar no Console do Navegador

Abra o console (F12) e escreva:

```javascript
// Ver estado completo da aplicação
debugCRIS.diagnosticar()

// Ver o que está armazenado no LocalStorage
debugCRIS.mostraLocalStorage()

// Limpar cache e recarregar
debugCRIS.limparCache()
```

---

## 📊 Logs Esperados ao Carregar

Quando a página carrega, você deve ver no console:

```
=== INICIANDO CARREGAMENTO DO MAPA ===
📄 Arquivos a carregar:
   1. CRIS-locaisdefault.json (padrão com dados)
   2. CRIS-locais.json (customizações)

Passo 1: Precarregando imagens de pins...
Passo 1 concluído

Passo 2: Precarregando imagem de membrana...
Passo 2 concluído. membraneImageLoaded = true

Passo 3: Registrando padrões de membrana...
Passo 3 concluído

Passo 4: Carregando dados de JSON...
📌 Locais padrão de CRIS-locaisdefault.json: 1
📌 Locais extras de CRIS-locais.json: 0
🔗 Conexões padrão: 0
🔗 Usando conexões padrão
📍 Zonas carregadas de CRIS-locaisdefault.json: 2
   - zone-1771879369191: Ponto de membrana (rompida)
   - zone-1771879399103: Membrana - asd (rompida)
💾 Zonas armazenadas em LocalStorage: 0
✓ Zonas finais carregadas: 2
   - zone-1771879369191: Ponto de membrana (rompida)
   - zone-1771879399103: Membrana - asd (rompida)
Passo 4 concluído. zonesFromFile.length = 2

Passo 5: Adicionando zonas ao mapa...
Adicionando 2 zonas ao mapa
Passo 5 concluído
```

---

## ✅ Checklist de Verificação

- [ ] Console mostra "2 zonas carregadas de CRIS-locaisdefault.json"
- [ ] Console mostra "Zonas armazenadas em LocalStorage: 0" (ou valor esperado)
- [ ] Console mostra "Adicionando 2 zonas ao mapa"
- [ ] Dois círculos brancos aparecem no mapa (as membranas)
- [ ] Um marcador "asd" aparece no mapa

---

## 🚀 Se Nada Aparecer

1. **Abra o console (F12)**
2. **Execute**: `debugCRIS.diagnosticar()`
3. **Se zonas = 0**: Execute `debugCRIS.limparCache()` para limpar LocalStorage contaminado
4. **Verifique os arquivos JSON** em CRIS-locaisdefault.json e CRIS-locais.json

---

## 📝 Notas Técnicas

- **Arquivo padrão** (CRIS-locaisdefault.json): Não mude manualmente, é referência
- **Arquivo customizado** (CRIS-locais.json): A aplicação preenche automaticamente
- **LocalStorage**: Armazena zonas criadas pelo usuário para persistir entre sessões
- **Normalização**: Dados são processados ao carregar (normalizeZone, normalizeLocation)
