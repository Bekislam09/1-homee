export const VEHICLES = {
  dozer: { id:'dozer', attack:'ram', turnRate:4.8, name:'Бульдозер', subtitle:'Скорость и напор', price:0, speed:180, cooldown:2.2, duration:.3, impactAt:0, reach:0, radius:0, damage:1, abilityName:'ТАРАН', description:'Быстрый рывок ковшом. Проходит через слабые постройки и проталкивает лёгкие обломки.' },
  excavator: { id:'excavator', attack:'point', turnRate:3.8, name:'Экскаватор', subtitle:'Точность и сила', price:1200, speed:145, cooldown:2.6, duration:.8, impactAt:.4, reach:115, radius:24, damage:2.5, abilityName:'УДАР КОВШОМ', description:'Мощный точечный удар на расстоянии. Особенно хорош против складов и башен.' },
  wrecker: { id:'wrecker', attack:'area', turnRate:3.2, name:'Разрушительный шар', subtitle:'Один удар — много целей', price:3000, speed:125, cooldown:3.5, duration:1.1, impactAt:.55, reach:125, radius:100, damage:1.4, abilityName:'УДАР ШАРОМ', description:'Медленный замах и удар по области. Задевает несколько соседних сооружений.' },
  roller: {id:'roller',name:'Road Roller',subtitle:'Heavy ground shock',price:6000,speed:135,turnRate:3.5,attack:'area',cooldown:3.4,duration:.96,impactAt:.48,reach:65,radius:105,damage:2,abilityName:'GROUND SHOCK',description:'A heavy steel drum sends a shock through nearby structures. Wide coverage at close range.'},
  drill: {id:'drill',name:'Hydraulic Breaker',subtitle:'Three precise impacts',price:10000,speed:155,turnRate:4,attack:'point',cooldown:2.8,duration:1,impactAt:.28,impacts:[.28,.46,.64],reach:110,radius:22,damage:1.8,abilityName:'BREAKER BURST',description:'Three hammer strikes on the nearest structure. Break reinforced buildings with a focused burst.'},
};
export const DISTRICTS = {
  town:{id:'town',name:'Солнечный квартал',description:'Тихие улицы, маленькие дома и первые большие планы.'},
  industrial:{id:'industrial',name:'Индустриальный район',description:'Кирпичные башни, склады и цепные реакции.'},
};
// Each contract requires real clearance, so an opening combo cannot end it immediately.
export const MISSIONS = [
  {id:1,title:'First Contract',district:'town',objective:'score',target:1800,minDestroyed:9,duration:180,reward:250,starTimes:[140,95]},
  {id:2,title:'Block by Block',district:'town',objective:'destroy',target:12,minDestroyed:12,duration:210,reward:400,starTimes:[160,110]},
  {id:3,title:'Domino District',district:'industrial',objective:'chain',target:3,minDestroyed:9,duration:210,reward:500,starTimes:[160,110]},
  {id:4,title:'Factory Reset',district:'industrial',objective:'score',target:3200,minDestroyed:11,duration:240,reward:650,starTimes:[180,125]},
  {id:5,title:'Main Street Makeover',district:'town',objective:'destroy',target:12,minDestroyed:12,duration:240,reward:750,starTimes:[185,130],variant:1,strength:1.25},
  {id:6,title:'Steel & Concrete',district:'industrial',objective:'score',target:3500,minDestroyed:12,duration:260,reward:850,starTimes:[200,145],variant:1,strength:1.2},
  {id:7,title:'End of the Block',district:'town',objective:'destroy',target:14,minDestroyed:14,duration:270,reward:950,starTimes:[210,150],variant:2,strength:1.35},
  {id:8,title:'Chain of Command',district:'industrial',objective:'chain',target:3,minDestroyed:13,duration:270,reward:1100,starTimes:[210,150],variant:2,strength:1.35},
  {id:9,title:'Heavy Duty',district:'town',objective:'score',target:2400,minDestroyed:13,duration:285,reward:1200,starTimes:[220,160],variant:3,strength:1.6},
  {id:10,title:'No Building Left Behind',district:'industrial',objective:'destroy',target:14,minDestroyed:14,duration:300,reward:1350,starTimes:[235,170],variant:3,strength:1.6},
  {id:11,title:'The Last Avenue',district:'town',objective:'destroy',target:14,minDestroyed:14,duration:300,reward:1500,starTimes:[235,175],variant:4,strength:1.8},
  {id:12,title:'Citywide Clearance',district:'industrial',objective:'score',target:3800,minDestroyed:14,duration:330,reward:1800,starTimes:[255,190],variant:4,strength:1.8},
].map(m=>{
  const sectors=m.id>=9?3:2;
  const clearance=(sectors-1)*14+m.minDestroyed;
  return {...m,sectors,minDestroyed:clearance,target:m.objective==='destroy'?clearance:m.objective==='score'?m.target*sectors:m.target,duration:m.duration+(sectors-1)*90,starTimes:m.starTimes.map(t=>t+(sectors-1)*50)};
});
export const getMission = id => MISSIONS.find(m=>m.id===Number(id)) || MISSIONS[0];
