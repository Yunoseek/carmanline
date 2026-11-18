import { makeCard } from '../web/core.mjs';
const f = (id, subject, title, latex, distractors, cue = '', allowJudge = false) => ({ id, kind: 'formula', subject, title, latex, distractors, cue, allowJudge });
const P = String.raw;
export const formulas = [
  f('p01','物理','单摆周期',P`T=2\pi\sqrt{\frac{l}{g}}`,[P`T=\pi\sqrt{\frac{l}{g}}`,P`T=4\pi\sqrt{\frac{l}{g}}`,P`T=2\sqrt{\frac{l}{g}}`,P`T=\frac{\pi}{2}\sqrt{\frac{l}{g}}`,P`T=\sqrt{2}\pi\sqrt{\frac{l}{g}}`],'小角度摆动，摆长为 l，重力加速度为 g'),
  f('p02','物理','动能',P`E_k=\frac{1}{2}mv^2`,[P`E_k=mv^2`,P`E_k=2mv^2`,P`E_k=\frac{1}{4}mv^2`,P`E_k=\frac{3}{2}mv^2`,P`E_k=\frac{1}{3}mv^2`]),
  f('p03','物理','弹性势能',P`E_p=\frac{1}{2}kx^2`,[P`E_p=kx^2`,P`E_p=2kx^2`,P`E_p=-\frac{1}{2}kx^2`,P`E_p=\frac{1}{4}kx^2`,P`E_p=\frac{3}{2}kx^2`]),
  f('p04','物理','胡克定律',P`F_x=-kx`,[P`F_x=kx`,P`F_x=-2kx`,P`F_x=-\frac{1}{2}kx`,P`F_x=2kx`,P`F_x=\frac{1}{2}kx`],'x 是相对平衡位置的有向位移；Fₓ 为回复力分量',true),
  f('p05','物理','匀变速位移',P`x=v_0t+\frac{1}{2}at^2`,[P`x=v_0t+at^2`,P`x=v_0t-\frac{1}{2}at^2`,P`x=\frac{1}{2}v_0t+at^2`,P`x=2v_0t+\frac{1}{2}at^2`,P`x=v_0t+2at^2`],'初位置为 0；加速度 a 带方向'),
  f('p06','物理','圆周运动向心力',P`F=\frac{mv^2}{r}`,[P`F=\frac{mv^2}{2r}`,P`F=\frac{2mv^2}{r}`,P`F=\frac{4mv^2}{r}`,P`F=\frac{mv^2}{4r}`,P`F=\frac{3mv^2}{r}`]),
  f('p07','物理','电容器储能',P`W=\frac{1}{2}CU^2`,[P`W=CU^2`,P`W=2CU^2`,P`W=\frac{1}{4}CU^2`,P`W=\frac{3}{2}CU^2`,P`W=\frac{1}{3}CU^2`]),
  f('p08','物理','简谐振动周期',P`T=2\pi\sqrt{\frac{m}{k}}`,[P`T=\pi\sqrt{\frac{m}{k}}`,P`T=4\pi\sqrt{\frac{m}{k}}`,P`T=2\sqrt{\frac{m}{k}}`,P`T=\frac{\pi}{2}\sqrt{\frac{m}{k}}`,P`T=\sqrt{2}\pi\sqrt{\frac{m}{k}}`],'理想弹簧振子，质量 m，劲度系数 k'),
  f('p09','物理','波长与频率',P`v=\lambda f`,[P`v=2\lambda f`,P`v=\frac{1}{2}\lambda f`,P`v=2\pi\lambda f`,P`v=\frac{\lambda f}{2\pi}`,P`v=\pi\lambda f`]),
  f('p10','物理','角频率与频率',P`\omega=2\pi f`,[P`\omega=\pi f`,P`\omega=\frac{f}{2\pi}`,P`\omega=2f`,P`\omega=4\pi f`,P`\omega=\frac{\pi f}{2}`]),
  f('m01','数学','正弦二倍角',P`\sin 2x=2\sin x\cos x`,[P`\sin 2x=\sin x\cos x`,P`\sin 2x=\sin^2x+\cos^2x`,P`\sin 2x=2\sin^2x`,P`\sin 2x=\cos^2x-\sin^2x`,P`\sin 2x=\sin x+\cos x`],'回想二倍角公式',true),
  f('m02','数学','余弦二倍角',P`\cos 2x=1-2\sin^2x`,[P`\cos 2x=1-\sin^2x`,P`\cos 2x=2\sin^2x-1`,P`\cos 2x=1+2\sin^2x`,P`\cos 2x=2\cos^2x+1`,P`\cos 2x=\cos^2x-1`]),
  f('m03','数学','正弦和角',P`\sin(x+y)=\sin x\cos y+\cos x\sin y`,[P`\sin(x+y)=\sin x\cos y-\cos x\sin y`,P`\sin(x+y)=\sin x+\sin y`,P`\sin(x+y)=\sin x\sin y+\cos x\cos y`,P`\sin(x+y)=\cos x\cos y-\sin x\sin y`,P`\sin(x+y)=2\sin x\cos y`]),
  f('m04','数学','余弦和角',P`\cos(x+y)=\cos x\cos y-\sin x\sin y`,[P`\cos(x+y)=\cos x\cos y+\sin x\sin y`,P`\cos(x+y)=\cos x+\cos y`,P`\cos(x+y)=\sin x\cos y+\cos x\sin y`,P`\cos(x+y)=\sin x\sin y-\cos x\cos y`,P`\cos(x+y)=2\cos x\cos y`]),
  f('m05','数学','正弦函数求导',P`(\sin x)'=\cos x`,[P`(\sin x)'=-\cos x`,P`(\sin x)'=\sin x`,P`(\sin x)'=-\sin x`,P`(\sin x)'=\frac{1}{\cos x}`,P`(\sin x)'=\tan x`],'x 以弧度计',true),
  f('m06','数学','余弦函数求导',P`(\cos x)'=-\sin x`,[P`(\cos x)'=\sin x`,P`(\cos x)'=\cos x`,P`(\cos x)'=-\cos x`,P`(\cos x)'=\frac{1}{\sin x}`,P`(\cos x)'=-\tan x`],'x 以弧度计'),
  f('m07','数学','自然对数求导',P`(\ln x)'=\frac{1}{x}`,[P`(\ln x)'=x`,P`(\ln x)'=-\frac{1}{x}`,P`(\ln x)'=\ln x`,P`(\ln x)'=\frac{1}{x^2}`,P`(\ln x)'=1`],'x > 0'),
  f('m08','数学','指数函数求导',P`(a^x)'=a^x\ln a`,[P`(a^x)'=a^x`,P`(a^x)'=xa^{x-1}`,P`(a^x)'=\frac{a^x}{\ln a}`,P`(a^x)'=a^x\log_a e`,P`(a^x)'=a^{x-1}\ln a`],'a > 0 且 a ≠ 1'),
  f('m09','数学','正切函数求导',P`(\tan x)'=\frac{1}{\cos^2x}`,[P`(\tan x)'=-\frac{1}{\cos^2x}`,P`(\tan x)'=\frac{1}{\sin^2x}`,P`(\tan x)'=\frac{1}{\cos x}`,P`(\tan x)'=\tan^2x`,P`(\tan x)'=-\frac{1}{\sin^2x}`],'cos x ≠ 0'),
  f('m10','数学','反正弦函数求导',P`(\arcsin x)'=\frac{1}{\sqrt{1-x^2}}`,[P`(\arcsin x)'=-\frac{1}{\sqrt{1-x^2}}`,P`(\arcsin x)'=\frac{1}{\sqrt{1+x^2}}`,P`(\arcsin x)'=\frac{1}{1-x^2}`,P`(\arcsin x)'=\sqrt{1-x^2}`,P`(\arcsin x)'=\frac{1}{1+x^2}`],'−1 < x < 1'),
  f('m11','数学','反正切函数求导',P`(\arctan x)'=\frac{1}{1+x^2}`,[P`(\arctan x)'=\frac{1}{1-x^2}`,P`(\arctan x)'=-\frac{1}{1+x^2}`,P`(\arctan x)'=\frac{1}{\sqrt{1+x^2}}`,P`(\arctan x)'=1+x^2`,P`(\arctan x)'=\frac{1}{x^2}`]),
  f('m12','数学','乘积求导',P`(uv)'=u'v+uv'`,[P`(uv)'=u'v'`,P`(uv)'=u'v-uv'`,P`(uv)'=u'+v'`,P`(uv)'=u'v'+uv`,P`(uv)'=u'v`]),
  f('m13','数学','商的求导',P`\left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2}`,[P`\left(\frac{u}{v}\right)'=\frac{u'v+uv'}{v^2}`,P`\left(\frac{u}{v}\right)'=\frac{uv'-u'v}{v^2}`,P`\left(\frac{u}{v}\right)'=\frac{u'}{v'}`,P`\left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v}`,P`\left(\frac{u}{v}\right)'=\frac{u'v-uv'}{u^2}`],'v ≠ 0'),
  f('m14','数学','幂函数不定积分',P`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C`,[P`\int x^n\,dx=\frac{x^{n-1}}{n-1}+C`,P`\int x^n\,dx=nx^{n-1}+C`,P`\int x^n\,dx=\frac{x^{n+1}}{n}+C`,P`\int x^n\,dx=(n+1)x^{n+1}+C`,P`\int x^n\,dx=\frac{x^n}{n+1}+C`],'n ≠ −1'),
  f('m15','数学','倒数函数不定积分',P`\int\frac{1}{x}\,dx=\ln|x|+C`,[P`\int\frac{1}{x}\,dx=-\ln|x|+C`,P`\int\frac{1}{x}\,dx=\frac{1}{x^2}+C`,P`\int\frac{1}{x}\,dx=-\frac{1}{x^2}+C`,P`\int\frac{1}{x}\,dx=x\ln|x|+C`,P`\int\frac{1}{x}\,dx=\frac{1}{2}\ln|x|+C`],'在不经过 0 的区间上'),
  f('m16','数学','正弦函数不定积分',P`\int\sin x\,dx=-\cos x+C`,[P`\int\sin x\,dx=\cos x+C`,P`\int\sin x\,dx=\sin x+C`,P`\int\sin x\,dx=-\sin x+C`,P`\int\sin x\,dx=\tan x+C`,P`\int\sin x\,dx=-\tan x+C`]),
  f('m17','数学','分部积分',P`\int u\,dv=uv-\int v\,du`,[P`\int u\,dv=uv+\int v\,du`,P`\int u\,dv=u'v-\int v\,du`,P`\int u\,dv=uv-\int u\,dv`,P`\int u\,dv=uv-\int u\,du`,P`\int u\,dv=\int v\,du-uv`]),
  f('m18','数学','指数函数展开',P`e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}`,[P`e^x=\sum_{n=0}^{\infty}\frac{(-1)^nx^n}{n!}`,P`e^x=\sum_{n=1}^{\infty}\frac{x^n}{n!}`,P`e^x=\sum_{n=0}^{\infty}\frac{x^n}{(n+1)!}`,P`e^x=\sum_{n=0}^{\infty}\frac{x^{2n}}{(2n)!}`,P`e^x=\sum_{n=0}^{\infty}\frac{x^{n+1}}{n!}`],'对所有实数 x 成立'),
  f('m19','数学','正弦函数展开',P`\sin x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n+1}}{(2n+1)!}`,[P`\sin x=\sum_{n=0}^{\infty}\frac{x^{2n+1}}{(2n+1)!}`,P`\sin x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n}}{(2n)!}`,P`\sin x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n+1}}{(2n)!}`,P`\sin x=\sum_{n=0}^{\infty}\frac{(-1)^{n+1}x^{2n+1}}{(2n+1)!}`,P`\sin x=\sum_{n=1}^{\infty}\frac{(-1)^nx^{2n+1}}{(2n+1)!}`],'对所有实数 x 成立'),
  f('m20','数学','等比数列求和',P`S_n=a_1\frac{1-q^n}{1-q}`,[P`S_n=a_1\frac{1-q^{n+1}}{1-q}`,P`S_n=a_1\frac{1-q^{n-1}}{1-q}`,P`S_n=a_1\frac{1+q^n}{1-q}`,P`S_n=a_1\frac{1-q^n}{1+q}`,P`S_n=a_1\frac{q^n-1}{1-q}`],'公比 q ≠ 1，前 n 项和'),
];
export const wrongs = [
 { id:'w01',kind:'wrong',subject:'数学',title:'复合函数求导',stem:P`设 $f(x)=\sin(x^2)$，则 $f'(x)$ 为`,options:[P`2x\cos(x^2)`,P`\cos(x^2)`,P`2x\sin(x^2)`,P`-2x\cos(x^2)`],answer:0 },
 { id:'w02',kind:'wrong',subject:'物理',title:'动能变化',stem:'质量不变的物体，速度从 v 增加到 2v，动能变为原来的多少倍？',options:['4 倍','2 倍','8 倍','不变'],answer:0 },
 { id:'w03',kind:'wrong',subject:'数学',title:'定积分计算',stem:P`计算 $\int_0^1 2x\,dx$`,options:['1','2','0',P`\frac{1}{2}`],answer:0 },
 { id:'w04',kind:'wrong',subject:'物理',title:'单摆周期比较',stem:'小角度摆动时，摆长变为原来的 4 倍，周期变为原来的多少倍？',options:['2 倍','4 倍','1/2 倍','不变'],answer:0 },
 { id:'w05',kind:'wrong',subject:'数学',title:'常见等价无穷小',stem:P`当 $x\to0$ 时，与 $1-\cos x$ 等价的是`,options:[P`\frac{x^2}{2}`,P`x^2`,P`x`,P`\frac{x}{2}`],answer:0 },
];
export function seed(now = Date.now()) {
 const cards = [...formulas, ...wrongs].map(c => makeCard(c, now));
 // One clearly labelled example demonstrates the separate focus lane.
 cards.push({ ...makeCard(f('focus-demo','数学','对数函数展开',P`\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}x^n}{n}`,[P`\ln(1+x)=\sum_{n=1}^{\infty}\frac{x^n}{n}`,P`\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^nx^n}{n}`,P`\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}x^n}{n!}`,P`\ln(1+x)=\sum_{n=0}^{\infty}\frac{(-1)^nx^n}{n+1}`,P`\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}x^{n+1}}{n}`],'−1 < x < 1'), now), focus: true });
 return cards;
}
