# Gerador de Pacotes IMS QTI 2.1 (Objetivas e Discursivas)

Um sistema web em **JavaScript puro e modular** (ES6 Modules) desenvolvido para converter questões em formato de texto simples em pacotes padronizados **IMS QTI 2.1 (.zip)**, 100% compatíveis com os principais Ambientes Virtuais de Aprendizagem (LMS) do mercado, como **Blackboard Learn, Canvas, Moodle**, entre outros.

---

## 🎯 Principais Funcionalidades

- **Editor de Texto Rico (WYSIWYG)**:
  - **Barra de Ferramentas de Formatação**: Negrito (`Ctrl+B`), Itálico (`Ctrl+I`), Sublinhado (`Ctrl+U`), Tachado, Sobrescrito ($x^2$), Subscrito ($H_2O$), Listas com Marcadores e Listas Numeradas.
  - **Manipulação Completa de Tabelas**: Inserção de tabelas com barra contextual para adicionar linhas acima/abaixo, colunas à esquerda/direita, excluir linhas/colunas e excluir tabelas.
  - **Gestão e Redimensionamento de Imagens**: Upload via botão, colagem direta (**`Ctrl+V`**) e **Arrastar e Soltar**. Barra contextual de redimensionamento (`25%`, `50%`, `75%`, `100%`, `tamanho em px`) e alinhamento (`Esquerda`, `Centro`, `Direita`).
  - **Higienização de HTML (Clear HTML)**: Limpa marcações sujas copiadas do Word ou Google Docs mantendo a estrutura semântica limpa e preservando estilos válidos de layout.
  - **Alternador de Código Fonte (Modo HTML)**: Permite visualizar e editar o código-fonte HTML puro da questão diretamente.
- **Múltipla Escolha (Objetiva)**:
  - Identificação automática da alternativa correta marcada com um asterisco (`*`).
  - Geração de regras de pontuação automática (`<responseProcessing>`).
  - Suporte a Gabarito Comentado / Feedback para o aluno (`<modalFeedback>`).
- **Discursiva (Resposta Aberta)**:
  - Campo de texto aberto (`<extendedTextInteraction>`).
  - **Padrão de Resposta exclusivo para o professor**: mapeado em `<rubricBlock view="scorer" use="scoring">` e `<correctResponse>`, servindo de base para a banca avaliadora sem ser exibido ao aluno.
  - **Feedback para o aluno**: mapeado em `<modalFeedback>`, visível após a entrega/correção.
- **Identificadores Padronizados**:
  - Questões numeradas como `QUE__00001`, `QUE__00002`, correspondendo ao arquivo Word de backup.
- **Monitor de Logs**:
  - Terminal visual na interface com rastreamento detalhado de cada etapa (parse, montagem de XML, empacotamento).
- **Exportação Client-Side Direta**:
  - Empacota automaticamente XMLs e imagens binárias no `.zip` diretamente no navegador.

---

## 📁 Estrutura do Projeto

O código foi projetado de forma modular e didática para facilitar o entendimento de cada etapa:

```text
GeradorQTI_Discursiva_objetiva/
├── index.html                   # Interface gráfica com editor rico, JSON e monitor de logs
├── README.md                    # Documentação do projeto
├── package.json                 # Configuração de scripts de testes (node:test)
├── css/
│   └── styles.css               # Estilos da interface, barra de ferramentas e terminal de logs
├── lib/
│   └── jszip.min.js             # Biblioteca client-side para compactação ZIP
├── js/
│   ├── app.js                   # Controlador principal da interface e fluxo de eventos
│   ├── logger.js                # Módulo de logs (tela e console do navegador)
│   ├── parser.js                # Analisador de texto e HTML rico para JSON estruturado
│   ├── editor/
│   │   ├── richTextEditor.js    # Componente WYSIWYG, toolbar, Ctrl+V, drag & drop
│   │   ├── tableHelper.js       # Manipulação de tabelas (adicionar/remover linhas/colunas)
│   │   ├── imageHelper.js       # Redimensionamento e alinhamento de imagens
│   │   ├── htmlSanitizer.js     # Sanitizador e conversor para XHTML válido QTI 2.1
│   │   └── assetManager.js      # Extrator de imagens em base64 e conversor de caminhos
│   └── qti/
│       ├── xmlHelpers.js        # Utilitários de escape e identificadores (QUE__00001)
│       ├── itemBuilder.js       # Gerador do assessmentItem0000X.xml (Objetiva e Discursiva)
│       ├── testBuilder.js       # Gerador do question_bank00001.xml (agrupador de teste)
│       ├── manifestBuilder.js   # Gerador do imsmanifest.xml (índice, recursos e mídias)
│       └── zipBuilder.js        # Montador da árvore de arquivos e disparador do download .zip
├── tests/                       # Suíte de testes automatizados (42 testes unitários)
│   ├── parser.test.js
│   ├── richParser.test.js
│   ├── tableHelper.test.js
│   ├── imageHelper.test.js
│   ├── htmlSanitizer.test.js
│   ├── assetManager.test.js
│   ├── itemBuilder.test.js
│   ├── testBuilder.test.js
│   ├── manifestBuilder.test.js
│   └── xmlHelpers.test.js
└── ExemplosQti/                 # Pacotes de referência no formato QTI 2.1
```

---

## 📝 Formato de Entrada no Editor

### 1. Questão de Múltipla Escolha (Objetiva)

Basta colocar um asterisco `*` na frente da alternativa correta (com ou sem formatação rica):

```text
Questão 1
Qual das seguintes linguagens é padrão para manipulação de bancos de dados relacionais?
*a) SQL (Structured Query Language)
b) HTML
c) CSS
d) Python
e) JSON

Feedback:
SQL é a linguagem padrão utilizada para consultas e manipulações em bancos de dados relacionais.
```

### 2. Questão Discursiva

Permite cadastrar o Enunciado, o **Padrão de Resposta** (guia do professor) e o **Feedback** (comentário do aluno):

```text
Questão 2
A Inteligência Artificial pode ser desenvolvida por meio de duas grandes abordagens: a simbólica e a baseada em dados. Com base nesses conceitos:
I) explique a diferença central entre a abordagem simbólica e a baseada em dados;
II) explique por que sistemas reais em uso hoje são classificados como ANI.

Padrão de resposta:
I) Na abordagem simbólica, o conhecimento é codificado explicitamente por humanos em forma de regras lógicas. Na abordagem baseada em dados, o sistema aprende padrões a partir de exemplos.
II) ANI (IA Estreita) é focada em tarefas específicas e é a única com aplicação prática atual; AGI e ASI ainda são conceitos teóricos.

Feedback:
Muito bem! Lembre-se de revisar as diferenças práticas entre os modelos simbólicos e conexionistas.
```

---

## 🏛️ Estrutura do Pacote QTI 2.1 Gerado (.zip)

Ao clicar em **"Gerar Pacote QTI (.zip)"**, o arquivo baixado possui a seguinte organização interna:

```text
Pool_ExportFile_Nome_Atividade.zip
│
├── imsmanifest.xml                  # Manifesto central que cataloga itens, schemas e imagens
├── img_q1_1.png                     # Imagens binárias extraídas do editor
├── csfiles/
│   └── home_dir/                    # Estrutura padrão de metadados
└── qti21/
    ├── question_bank00001.xml       # Define o Assessment Test / Pool e sequencia as questões
    ├── assessmentItem00001.xml      # XML da Questão 1
    ├── assessmentItem00002.xml      # XML da Questão 2
    └── ...
```

---

## 🧪 Testes Automatizados

O projeto conta com uma suíte completa de **36 testes unitários** desenvolvida com o test runner nativo do Node.js (`node:test` e `node:assert`), cobrindo 100% dos módulos do sistema:

```bash
npm test
```

### O que os testes cobrem:
- **`htmlSanitizer.test.js`**: Limpeza de código proprietário do Word/Docs, remoção de tags perigosas, conversão para XHTML válido e fechamento de tags vazias.
- **`assetManager.test.js`**: Extração de imagens Base64, geração de nomes sequenciais e mapeamento de caminhos relativos.
- **`richParser.test.js` & `parser.test.js`**: Parsing de textos planos e formatados em HTML com tabelas, fórmulas, sobrescritos, alternativas com `*`, padrões de resposta e feedbacks.
- **`itemBuilder.test.js`**: Validação dos XMLs gerados (`QUE__00001`, `choiceInteraction`, `extendedTextInteraction`, `rubricBlock view="scorer"`, `correctResponse`, `modalFeedback`).
- **`xmlHelpers.test.js`**: Escape seguro de entidades XML, conversão de parágrafos e identificadores.
- **`testBuilder.test.js` & `manifestBuilder.test.js`**: Estrutura do `question_bank00001.xml` e `imsmanifest.xml` com catálogo de recursos e mídias.

---

## 🚀 Como Executar a Interface Web

Não é necessária nenhuma instalação de dependências para rodar a aplicação no navegador:

1. Dê um duplo clique no arquivo [`index.html`](file:///c:/Temp/Adriano/Projetos/GeradorQTI_Discursiva_objetiva/index.html) para abrir diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).
2. Opcionalmente, pode ser servido via qualquer servidor estático local (como Live Server do VS Code ou `npx serve .`).
