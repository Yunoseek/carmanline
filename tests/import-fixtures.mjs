export const formula={kind:'formula',subject:'数学',title:'平方差公式',latex:'a^2-b^2=(a+b)(a-b)',cue:'a、b 为实数',distractors:['a^2-b^2=(a-b)^2','a^2-b^2=(a+b)^2','a^2-b^2=a(a-b)']};
export const secondFormula={...formula,title:'完全平方公式',latex:'(a+b)^2=a^2+2ab+b^2',distractors:['(a+b)^2=a^2+b^2','(a+b)^2=a^2+ab+b^2','(a+b)^2=a^2-2ab+b^2']};
export const wrong={kind:'wrong',subject:'数学',title:'幂函数求导',stem:'函数 $f(x)=x^2$ 的导数是？',options:['$2x$','$x$','$x^2$','$2$'],answer:0};
export const jsonFor=(items,kind='formula')=>JSON.stringify({format:'carmanline.'+kind+'.v1',items});
