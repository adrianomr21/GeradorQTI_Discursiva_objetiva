import { describe, it } from 'node:test';
import assert from 'node:assert';
import { QuestionParser } from '../js/parser.js';

describe('Rich HTML Parsing in QuestionParser', () => {
  it('deve parsear questão com formatação HTML rica (negrito, itálico, sobrescrito)', () => {
    const richInput = `
      <p><strong>Questão 1</strong></p>
      <p>Calcule a derivada da função <em>f(x)</em> = x<sup>2</sup> + 3x.</p>
      <p>*a) <strong>2x + 3</strong></p>
      <p>b) 2x</p>
      <p>c) x + 3</p>
      <p><strong>Feedback:</strong></p>
      <p>A derivada de x<sup>2</sup> é 2x e a derivada de 3x é 3.</p>
    `;

    const parsed = QuestionParser.parse(richInput, 1);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'multiple_choice');
    assert.ok(parsed.prompt.includes('<em>f(x)</em> = x<sup>2</sup> + 3x'));
    assert.strictEqual(parsed.options.length, 3);
    assert.strictEqual(parsed.options[0].isCorrect, true);
    assert.ok(parsed.options[0].text.includes('<strong>2x + 3</strong>'));
    assert.ok(parsed.feedback.includes('x<sup>2</sup>'));
  });

  it('deve preservar tabelas completas no enunciado', () => {
    const tableInput = `
      <p>Questão 2</p>
      <p>Analise os dados da tabela abaixo:</p>
      <table class="qti-table">
        <thead><tr><th>Ano</th><th>Vendas</th></tr></thead>
        <tbody><tr><td>2022</td><td>100k</td></tr></tbody>
      </table>
      <p>Padrão de resposta:</p>
      <p>O crescimento foi constante.</p>
      <p>Feedback:</p>
      <p>Muito bem!</p>
    `;

    const parsed = QuestionParser.parse(tableInput, 2);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'discursive');
    assert.ok(parsed.prompt.includes('<table'));
    assert.ok(parsed.prompt.includes('<th>Ano</th>'));
    assert.ok(parsed.prompt.includes('<td>2022</td>'));
    assert.ok(parsed.modelAnswer.includes('O crescimento foi constante.'));
    assert.ok(parsed.feedback.includes('Muito bem!'));
  });

  it('deve parsear perfeitamente HTML exportado do Microsoft Word com quebras de linha internas e estilos inline', () => {
    const wordHtml = `<p style="margin-top:13.0pt;margin-right:0cm;margin-bottom:
4.0pt;margin-left:0cm"><strong><span style="font-size:11.5pt;line-height:115%;
font-family:&quot;Arial&quot;,sans-serif;color:#1F4E79">Questão 1</span></strong></p>

<p style="margin-top:1.0pt;margin-right:0cm;margin-bottom:5.0pt;
margin-left:0cm;text-align:justify"><span style="font-family:&quot;Arial&quot;,sans-serif;
color:#1A1A1A">A Inteligência Artificial é mais bem descrita como:</span></p>

<p style="margin-top:4.0pt;margin-right:0cm;margin-bottom:1.0pt;
margin-left:18.0pt"><strong><span style="font-family:&quot;Arial&quot;,sans-serif;color:#C00000">*A)
Um campo da ciência da computação dedicado a sistemas capazes de realizar
tarefas que, se feitas por humanos, exigiriam alguma forma de inteligência.</span></strong></p>

<p style="margin-top:4.0pt;margin-right:0cm;margin-bottom:1.0pt;
margin-left:18.0pt"><span style="font-family:&quot;Arial&quot;,sans-serif;color:#1A1A1A">B)
Uma tecnologia única e padronizada, aplicada da mesma forma a qualquer tipo de
tarefa computacional.</span></p>

<p style="margin-top:4.0pt;margin-right:0cm;margin-bottom:1.0pt;
margin-left:18.0pt"><span style="font-family:&quot;Arial&quot;,sans-serif;color:#1A1A1A">C)
Um sistema robótico humanoide capaz de se mover e interagir fisicamente com o
ambiente.</span></p>

<p style="margin-top:4.0pt;margin-right:0cm;margin-bottom:1.0pt;
margin-left:18.0pt"><span style="font-family:&quot;Arial&quot;,sans-serif;color:#1A1A1A">D)
Um sistema que supera a inteligência humana em todas as dimensões de raciocínio
e criatividade.</span></p>

<p style="margin-top:4.0pt;margin-right:0cm;margin-bottom:1.0pt;
margin-left:18.0pt"><span style="font-family:&quot;Arial&quot;,sans-serif;color:#1A1A1A">E)
Um conjunto de regras administrativas usadas apenas por grandes corporações de
tecnologia.</span></p>

<p style="margin-top:3.0pt;margin-right:0cm;margin-bottom:3.0pt;
margin-left:0cm">&nbsp;</p>

<p style="margin-top:3.0pt;margin-right:0cm;margin-bottom:3.0pt;
margin-left:0cm">Feedback:<br>
A Inteligência Artificial é corretamente descrita como um campo da ciência da computação
dedicado ao desenvolvimento de sistemas capazes de realizar tarefas que, quando
executadas por seres humanos, exigiriam alguma forma de inteligência. Esse
campo abrange aplicações como reconhecimento de padrões, tradução de textos e
detecção de fraudes, caracterizando-se por sua ampla diversidade de abordagens,
técnicas e subáreas.</p>`;

    const parsed = QuestionParser.parse(wordHtml, 1);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'multiple_choice');
    assert.strictEqual(parsed.options.length, 5);
    assert.strictEqual(parsed.options[0].isCorrect, true);
    assert.strictEqual(parsed.options[0].letter, 'a');
    assert.ok(parsed.options[0].text.includes('Um campo da ciência da computação'));
    assert.strictEqual(parsed.options[1].isCorrect, false);
    assert.strictEqual(parsed.options[1].letter, 'b');
    assert.ok(parsed.feedback.includes('A Inteligência Artificial é corretamente descrita'));
  });
});
