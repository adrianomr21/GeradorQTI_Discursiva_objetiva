# Gerador de Pacotes IMS QTI 2.1 (Objetivas e Discursivas)

Um sistema web em **JavaScript puro e modular** (ES6 Modules) desenvolvido para converter questões em formato de texto simples em pacotes padronizados **IMS QTI 2.1 (.zip)**, 100% compatíveis com os principais Ambientes Virtuais de Aprendizagem (LMS) do mercado, como **Blackboard Learn, Canvas, Moodle**, entre outros.

---

## 🎯 Principais Funcionalidades

- **Múltipla Escolha (Objetiva)**:
  - Identificação automática da alternativa correta marcada com um asterisco (`*`).
  - Geração de regras de pontuação automática (`<responseProcessing>`).
  - Suporte a Gabarito Comentado / Feedback para o aluno (`<modalFeedback>`).
- **Discursiva (Resposta Aberta)**:
  - Campo de texto aberto (`<extendedTextInteraction>`).
  - **Padrão de Resposta exclusivo para o professor**: mapeado em `<rubricBlock view="scorer" use="scoring">` e `<correctResponse>`, servindo de base para a banca avaliadora sem ser exibido ao aluno.
  - **Feedback para o aluno**: mapeado em `<modalFeedback>`, visível após a entrega/correção.
- **Parser de Texto Inteligente**:
  - Aceita colagem direta de questões sem formulários complexos.
  - Não confunde parágrafos ou numerações romanas (`I)`, `II)`) com alternativas.
- **Visualizador de JSON em Tempo Real**:
  - Exibe a estrutura de dados gerada instantaneamente.
- **Monitor de Logs**:
  - Terminal visual na interface com rastreamento detalhado de cada etapa (parse, montagem de XML, empacotamento).
- **Exportação Client-Side Direta**:
  - Compacta e faz o download do `.zip` diretamente no navegador (sem necessidade de servidor backend ou banco de dados).

---

## 📁 Estrutura do Projeto

O código foi projetado de forma modular e didática para facilitar o entendimento de cada etapa do padrão QTI:

```text
GeradorQTI_Discursiva_objetiva/
├── index.html                   # Interface gráfica com editor, JSON e monitor de logs
├── README.md                    # Documentação do projeto
├── css/
│   └── styles.css               # Estilos da interface e painel de monitoramento
├── lib/
│   └── jszip.min.js             # Biblioteca client-side para compactação ZIP
├── js/
│   ├── app.js                   # Controlador principal da interface e fluxo de eventos
│   ├── logger.js                # Módulo de logs (tela e console do navegador)
│   ├── parser.js                # Analisador de texto puro para JSON estruturado
│   └── qti/
│       ├── xmlHelpers.js        # Utilitários de escape e formatação de XHTML/XML
│       ├── itemBuilder.js       # Gerador do assessmentItem0000X.xml (Objetiva e Discursiva)
│       ├── testBuilder.js       # Gerador do question_bank00001.xml (agrupador de teste)
│       ├── manifestBuilder.js   # Gerador do imsmanifest.xml (índice e dependências)
│       └── zipBuilder.js        # Montador da árvore de arquivos e disparador do download .zip
└── ExemplosQti/                 # Pacotes de referência no formato QTI 2.1
```

---

## 📝 Formato de Entrada no Editor

### 1. Questão de Múltipla Escolha (Objetiva)

Basta colocar um asterisco `*` na frente da alternativa correta:

```text
Questão 1
Qual das seguintes linguagens é padrão para manipulação de bancos de dados relacionais?
*a) SQL
b) HTML
c) CSS
d) Python
e) JSON

Feedback:
SQL (Structured Query Language) é a linguagem padrão utilizada para consultas e manipulações em bancos de dados relacionais.
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
├── imsmanifest.xml                  # Manifesto central que cataloga itens e schemas
├── csfiles/
│   └── home_dir/                    # Estrutura padrão de metadados
└── qti21/
    ├── question_bank00001.xml       # Define o Assessment Test / Pool e sequencia as questões
    ├── assessmentItem00001.xml      # XML da Questão 1
    ├── assessmentItem00002.xml      # XML da Questão 2
    └── ...
```

### Mapeamento no XML Discursivo:

```xml
<assessmentItem ... identifier="QUE__00001">
  <responseDeclaration cardinality="single" baseType="string" identifier="RESPONSE">
    <!-- Padrão de Resposta -->
    <correctResponse>
      <value>Texto da resposta modelo...</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <div>
      <p>Texto do Enunciado...</p>
    </div>
    <extendedTextInteraction responseIdentifier="RESPONSE"/>
    
    <!-- Padrão de Resposta EXCLUSIVO DO PROFESSOR (view="scorer") -->
    <rubricBlock view="scorer" use="scoring">
      <div>
        <p>Texto da resposta modelo para correção...</p>
      </div>
    </rubricBlock>
  </itemBody>

  <!-- Feedback VISÍVEL AO ALUNO -->
  <modalFeedback showHide="show" outcomeIdentifier="FEEDBACKBASIC" identifier="correct_fb">
    <div>
      <p>Comentário pedagógico para o aluno...</p>
    </div>
  </modalFeedback>
</assessmentItem>
```

---

## 🚀 Como Executar

Não é necessária nenhuma instalação de dependências ou Node.js para rodar a aplicação:

1. Dê um duplo clique no arquivo [`index.html`](file:///c:/Temp/Adriano/Projetos/GeradorQTI_Discursiva_objetiva/index.html) para abrir diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).
2. Opcionalmente, pode ser servido via qualquer servidor estático local (como Live Server do VS Code ou `npx serve .`).
