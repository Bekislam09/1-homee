export const VEHICLES = {
  dozer: { id:'dozer', name:'Бульдозер', subtitle:'Скорость и напор', price:0, speed:180, cooldown:2.2, duration:.3, impactAt:0, reach:0, radius:0, damage:1, abilityName:'ТАРАН', description:'Быстрый рывок ковшом. Проходит через слабые постройки и проталкивает лёгкие обломки.' },
  excavator: { id:'excavator', name:'Экскаватор', subtitle:'Точность и сила', price:300, speed:145, cooldown:2.6, duration:.8, impactAt:.4, reach:115, radius:24, damage:2.5, abilityName:'УДАР КОВШОМ', description:'Мощный точечный удар на расстоянии. Особенно хорош против складов и башен.' },
  wrecker: { id:'wrecker', name:'Разрушительный шар', subtitle:'Один удар — много целей', price:650, speed:125, cooldown:3.5, duration:1.1, impactAt:.55, reach:125, radius:100, damage:1.4, abilityName:'УДАР ШАРОМ', description:'Медленный замах и удар по области. Задевает несколько соседних сооружений.' },
};
export const DISTRICTS = {
  town:{id:'town',name:'Солнечный квартал',description:'Тихие улицы, маленькие дома и первые большие планы.'},
  industrial:{id:'industrial',name:'Индустриальный район',description:'Кирпичные башни, склады и цепные реакции.'},
};
export const MISSIONS = [
  {id:1,title:'Начало разрушений',district:'town',objective:'score',target:1000,duration:90,reward:150,starTimes:[65,35],description:'Набери 1 000 очков за 90 секунд.'},
  {id:2,title:'Срочный снос',district:'town',objective:'destroy',target:8,duration:100,reward:250,starTimes:[80,55],description:'Снеси 8 зданий за 100 секунд.'},
  {id:3,title:'Большое обрушение',district:'industrial',objective:'chain',target:3,duration:100,reward:350,starTimes:[70,45],description:'Запусти цепную реакцию из 3 сооружений.'},
  {id:4,title:'Мастер разрушений',district:'industrial',objective:'score',target:2400,duration:120,reward:500,starTimes:[90,60],description:'Набери 2 400 очков за 120 секунд.'},
];
export const getMission = id => MISSIONS.find(m=>m.id===Number(id)) || MISSIONS[0];
