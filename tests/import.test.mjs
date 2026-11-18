import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {parseImport,parseImportBatch,parsePhotoResponse,photoPrompt,parseChatResult,validateItem,pickContent,externalPrompt,chatSystemPrompt,FORMATS,MAX_IMPORT_BYTES} from '../web/import.mjs';
const render=latex=>katex.renderToString(latex,{throwOnError:true,strict:'error',trust:false});
const formula=()=>({kind:'formula',subject:'数学',title:'导数',latex:'\\frac{d}{dx}x^2=2x',cue:'x 为实数',distractors:['x^2=x','x^2=2','x^2=x^3']});
const wrong=()=>({kind:'wrong',subject:'数学',title:'求导',stem:'$x^2$ 的导数是？',options:['$2x$','$x$'],answer:0});
const json=(items,kind='formula')=>JSON.stringify({format:FORMATS[kind],items});
test('formula contract accepts escaped LaTeX, BOM and an enclosing JSON code block',()=>{
 const f=formula();assert.deepEqual(parseImport('\uFEFF'+json([f]),'formula',render),[f]);assert.deepEqual(parseImport('```json\n'+json([f])+'\n```','formula',render),[f]);
});
test('wrong-question contract preserves zero-based correct answer and inline math',()=>{
 assert.deepEqual(parseImport(json([wrong()],'wrong'),'wrong',render),[wrong()]);
 for(const answer of ['0','A',-1,2,0.5])assert.throws(()=>parseImport(json([{...wrong(),answer}],'wrong'),'wrong',render),/answer/);
});
test('formulas and wrong questions cannot enter each other’s library',()=>{
 assert.throws(()=>parseImport(json([wrong()],'wrong'),'formula',render),/format/);
 assert.throws(()=>parseImport(json([wrong()]),'formula',render),/kind|不支持/);
});
test('unrecognized fields and scheduling or settings injection are rejected',()=>{
 for(const key of ['id','due','box','settings','__proto__']) {
  const f=formula();Object.defineProperty(f,key,{value:'injected',enumerable:true});assert.throws(()=>parseImport(json([f]),'formula',render),/不支持/);
 }
 assert.throws(()=>parseImport(JSON.stringify({format:FORMATS.formula,items:[formula()],endpoint:'x'}),'formula',render),/endpoint/);
});
test('bad LaTeX and missing JSON escapes produce actionable errors',()=>{
 assert.throws(()=>parseImport(json([{...formula(),latex:'\\notARealKatexCommand{'}]),'formula',render),/latex.*无法渲染/);
 assert.throws(()=>parseImport('{"format":"carmanline.formula.v1","items":[{"latex":"\\x"}]}','formula',render),/反斜杠/);
});
test('duplicate, blank or too few distractors cannot be imported',()=>{
 for(const distractors of [[],['x=1','x=2'],['x=1','x=1','x=2'],['x=1',' ','x=2'],[formula().latex,'x=1','x=2']])assert.throws(()=>validateItem({...formula(),distractors},'formula',render),/distractors/);
});
test('wrong-question math delimiters, empty and duplicate options are validated',()=>{
 assert.throws(()=>validateItem({...wrong(),stem:'未闭合 $x^2'},'wrong',render),/成对/);
 assert.throws(()=>validateItem({...wrong(),stem:'$$x$$'},'wrong',render),/单个/);
 assert.throws(()=>validateItem({...wrong(),options:['2','2']},'wrong',render),/重复/);
 assert.throws(()=>validateItem({...wrong(),options:['','2']},'wrong',render),/不能为空/);
});
test('batch errors identify the exact row and leave the input untouched',()=>{
 const items=[formula(),{...formula(),subject:''}],before=JSON.stringify(items);
 assert.throws(()=>parseImport(json(items),'formula',render),/第 2 条.subject/);assert.equal(JSON.stringify(items),before);
});
test('required fields, item limits, empty results and oversized text are rejected',()=>{
 const f=formula();delete f.cue;assert.throws(()=>parseImport(json([f]),'formula',render),/cue/);
 assert.throws(()=>parseImport(json([]),'formula',render),/1～100/);
 assert.throws(()=>parseImport(json(Array(101).fill(formula())),'formula',render),/101 条，超出上限 100 条/);
 assert.throws(()=>parseImport(' '.repeat(MAX_IMPORT_BYTES+1),'formula',render),/2 MB/);
});
test('syntax errors include the location and partial batches retain original rows',()=>{
 const invalid='{"format":"carmanline.formula.v1",\n"items":[,]}';
 assert.throws(()=>parseImportBatch(invalid,'formula',render),/第 2 行，第 10 列/);
 const good=formula(), bad={...good};delete bad.latex;
 const report=parseImportBatch(json([bad,good]),'formula',render);
 assert.deepEqual(report.sourceIndices,[2]);assert.equal(report.issues[0].index,1);assert.deepEqual(report.issues[0].raw,bad);
});
test('AI replies require a complete validated item without changing the caller’s draft',()=>{
 const f=formula(),original=JSON.stringify(f);assert.deepEqual(parseChatResult({reply:'已修改',item:f},'formula',render).item,f);
 assert.throws(()=>parseChatResult({reply:'已修改',item:{...f,distractors:[]}},'formula',render),/AI 草稿.distractors/);
 assert.throws(()=>parseChatResult({reply:'已修改',item:wrong()},'formula',render));assert.equal(JSON.stringify(f),original);
});
test('only content fields are retained when saving a draft',()=>{
 assert.deepEqual(pickContent({...formula(),id:'old-id',due:'2099-01-01',imageIndex:2,preview:'image'}),formula());
});
test('both external prompts contain valid import examples and enforce separate contracts',()=>{
 for(const kind of ['formula','wrong']) {
  const prompt=externalPrompt(kind),example=/```json\n([\s\S]+)\n```$/.exec(prompt)[1];
  assert.equal(parseImport(example,kind,render)[0].kind,kind);assert.ok(prompt.includes(FORMATS[kind]));assert.match(prompt,/反斜杠/);
  const chat=chatSystemPrompt(kind);assert.match(chat,/"reply"/);assert.match(chat,/"item"/);assert.match(chat,/不要额外输出 format 或 items/);
 }
});
test('mixed batches retain valid items on both sides of an unrenderable formula',()=>{
 const good=formula(),bad={...formula(),latex:'\\unknownCommand{x}'};
 const input=json([good,bad,{...good,title:'另一条'}]),before=input;
 const report=parseImportBatch(input,'formula',render);
 assert.deepEqual(report.items.map(c=>c.title),[good.title,'另一条']);assert.equal(report.issues.length,1);assert.equal(report.issues[0].index,2);assert.equal(report.issues[0].skipped,true);assert.equal(input,before);
});
test('a bad distractor is removed when at least three valid distinct variants remain',()=>{
 const f=formula();f.distractors.push('\\unknown{x}');
 const report=parseImportBatch(json([f]),'formula',render);
 assert.equal(report.items.length,1);assert.equal(report.items[0].distractors.length,3);assert.equal(report.issues[0].skipped,false);
});
test('insufficient valid variants skip one item without discarding the rest',()=>{
 const f={...formula(),distractors:['x=1','x=2','\\unknown{x}']};
 const report=parseImportBatch(json([f,formula()]),'formula',render);
 assert.equal(report.items.length,1);assert.match(report.issues[0].message,/不足 3/);
});
test('an invalid answer only skips its own wrong-question entry',()=>{
 const report=parseImportBatch(json([{...wrong(),answer:8},wrong()],'wrong'),'wrong',render);
 assert.equal(report.items.length,1);assert.equal(report.items[0].answer,0);assert.equal(report.issues[0].skipped,true);
});
test('legacy photo bbox is ignored without changing the external JSON contract',()=>{
 const raw={format:FORMATS.formula,items:[{...formula(),bbox:[0,0,100,100]}]};
 const report=parsePhotoResponse({modelOutput:JSON.stringify(raw),finishReason:'stop'},'formula',render);
 assert.deepEqual(report.items,[formula()]);assert.ok(!Object.hasOwn(report.items[0],'bbox'));
 assert.throws(()=>parseImport(JSON.stringify(raw),'formula',render),/bbox/);
});
test('interrupted photo replies retain complete objects and never import the truncated tail',()=>{
 const f={...formula(),title:'含括号 } ] 和引号 " 的公式'};
 const output='{"format":"'+FORMATS.formula+'","items":['+JSON.stringify(f)+','+JSON.stringify({...formula(),latex:'\\unknown{x}'})+',{"kind":"formula","latex":"unfinished';
 const report=parsePhotoResponse({modelOutput:output,finishReason:'length'},'formula',render);
 assert.deepEqual(report.items,[f]);assert.equal(report.issues.filter(i=>i.skipped).length,1);assert.match(report.issues[0].title,/未完整/);
});
test('photo recovery locates the top-level items array and ignores nested arrays',()=>{
 const output='{"metadata":{"items":[{"kind":"fake"}]},"items":['+JSON.stringify(formula())+',{"title":"cut';
 assert.deepEqual(parsePhotoResponse({modelOutput:output,finishReason:'aborted'},'formula',render).items,[formula()]);
});
test('blank, malformed completed replies and entirely incomplete objects are not guessed',()=>{
 assert.throws(()=>parsePhotoResponse({modelOutput:'   ',finishReason:'stop'},'formula',render),/返回为空/);
 assert.throws(()=>parsePhotoResponse({modelOutput:'{"items":[',finishReason:'stop'},'formula',render),/JSON 格式有误/);
 assert.throws(()=>parsePhotoResponse({modelOutput:'{"items":[{"latex":"cut',finishReason:'length'},'formula',render),/1～100/);
});
test('literal JSON control escapes cannot silently turn frac or theta into plain text',()=>{
 for(const latex of ['\frac{x}{2}','\theta=1'])assert.throws(()=>validateItem({...formula(),latex},'formula',render),/控制字符/);
});
test('copyable prompts show escaped integral examples while photo prompts request bounded raw JSON',()=>{
 const prompt=externalPrompt('formula'),match=/```json\n([\s\S]+)\n```$/.exec(prompt);
 assert.ok(match[1].includes('\\\\int'));assert.ok(match[1].includes('\\\\frac'));assert.equal(parseImport(match[0],'formula',render).length,1);
 const photo=photoPrompt('formula');assert.match(photo,/最多 12 条/);assert.match(photo,/每条只生成 3 个/);assert.match(photo,/不能添加 bbox/);assert.ok(!photo.includes('```json'));assert.match(prompt,/不构成错误/);
});
