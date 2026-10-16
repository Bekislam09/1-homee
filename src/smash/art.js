// All artwork is drawn locally. World positions stay independent of projection.
const SQRT3_2 = Math.sqrt(3) / 2;
export const iso = (x, y, z = 0) => ({ x: (x - y) * SQRT3_2, y: (x + y) * 0.5 - z });
export const ART_ANCHOR = Object.freeze({ building: 58, dozer: 44, machine: 110, decor: 36 });
export const getVehicleTextureOffset = id => id === 'dozer' ? ART_ANCHOR.dozer : ART_ANCHOR.machine;

const C = {
  ink: '#294b46', grass: '#a4ceb0', grassLight: '#b9dabc', darkGrass: '#7db899',
  road: '#677e7c', curb: '#f4e8cd', line: '#d5d9bd', gold: '#ffcb50',
};

function polygon(ctx, points, fill, stroke = null, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function texture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas.getContext();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  draw(ctx, width, height);
  canvas.refresh();
}
function localProject(ctx, width, height, anchor) {
  ctx.translate(width / 2, height - anchor);
  return (x, y, z = 0) => iso(x, y, z);
}
function face(ctx, p, coordinates, fill, stroke = null, width = 1) {
  polygon(ctx, coordinates.map(([x, y, z]) => p(x, y, z)), fill, stroke, width);
}
function box(ctx, p, x, y, z, w, d, h, colors) {
  const x2 = x + w; const y2 = y + d; const z2 = z + h;
  face(ctx, p, [[x,y2,z],[x2,y2,z],[x2,y2,z2],[x,y2,z2]], colors[0]);
  face(ctx, p, [[x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]], colors[1]);
  face(ctx, p, [[x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]], colors[2]);
}
function frontPanel(ctx, p, x, y, z, w, h, fill, edge = null) {
  face(ctx, p, [[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]], fill, edge, 1.3);
}
function sidePanel(ctx, p, x, y, z, w, h, fill, edge = null) {
  face(ctx, p, [[x,y,z],[x,y+w,z],[x,y+w,z+h],[x,y,z+h]], fill, edge, 1.3);
}
function windowFront(ctx, p, x, y, z, w, h, broken = false) {
  frontPanel(ctx,p,x-2,y,z-2,w+4,h+4,'#f5e8cb');
  frontPanel(ctx,p,x,y+0.1,z,w,h,broken ? '#35545c' : '#79b8c4');
  frontPanel(ctx,p,x+2,y+0.2,z+h*.56,w-4,h*.32,broken ? '#54818c' : '#b8e4df');
  line(ctx,[p(x+w/2,y+.3,z),p(x+w/2,y+.3,z+h)],'#f7edda',2);
  line(ctx,[p(x,y+.3,z+h*.48),p(x+w,y+.3,z+h*.48)],'#f7edda',2);
  if (broken) line(ctx,[p(x+2,y+.4,z+1),p(x+w-2,y+.4,z+h-2)],'#d49b6b',3.4);
  frontPanel(ctx,p,x-4,y+2,z-4,w+8,3,'#e4d1aa');
}
function windowSide(ctx, p, x, y, z, w, h, broken = false) {
  sidePanel(ctx,p,x,y-2,z-2,w+4,h+4,'#e3d8bb');
  sidePanel(ctx,p,x+.1,y,z,w,h,broken ? '#35545c' : '#538f9c');
  sidePanel(ctx,p,x+.2,y+2,z+h*.58,w-4,h*.29,broken ? '#527981' : '#8fcad2');
  line(ctx,[p(x+.3,y+w/2,z),p(x+.3,y+w/2,z+h)],'#e3d8bb',2);
  line(ctx,[p(x+.3,y,z+h*.48),p(x+.3,y+w,z+h*.48)],'#e3d8bb',2);
  if (broken) line(ctx,[p(x+.4,y+1,z+h-2),p(x+.4,y+w-1,z+2)],'#a87c5d',3);
}

function roof(ctx, p, w, d, wall, peak, colors) {
  const overhang = 6;
  const x1 = -w/2-overhang; const x2 = w/2+overhang;
  const y1 = -d/2-overhang; const y2 = d/2+overhang;
  // The visible gable, both roof slopes and a pale fascia give a soft toy silhouette.
  face(ctx,p,[[w/2,-d/2,wall],[w/2,d/2,wall],[w/2,0,peak-2]],'#f0d8b5');
  face(ctx,p,[[x1,y1,wall+2],[x2,y1,wall+2],[x2,0,peak],[x1,0,peak]],colors[1]);
  face(ctx,p,[[x1,0,peak],[x2,0,peak],[x2,y2,wall+2],[x1,y2,wall+2]],colors[0]);
  line(ctx,[p(x1,0,peak),p(x2,0,peak)],colors[2],3.5);
  line(ctx,[p(x1,y2,wall),p(x2,y2,wall),p(x2,0,peak),p(x2,y1,wall)],'#f4d9ad',2.5);
  for (let x = x1+15; x < x2; x += 17) {
    line(ctx,[p(x,0,peak-.5),p(x,y2,wall+2)],colors[1],1);
  }
  for (let y = 13; y < y2; y += 14) {
    const z = peak - (peak-wall-2)*y/y2;
    line(ctx,[p(x1,y,z),p(x2,y,z)],colors[2],.8);
  }
}

function cracks(ctx, p, type, stage) {
  if (!stage) return;
  const height = type === 'house' ? 108 : type === 'kiosk' ? 72 : 42;
  const front = [[-33,43,height-9],[-25,43,height-21],[-29,43,height-33],[-17,43,height-39],[-20,43,height-53]];
  line(ctx,front.map(v => p(...v)),'#5e6157',2.1);
  line(ctx,[p(-25,43,height-21),p(-13,43,height-24),p(-7,43,height-18)],'#5e6157',1.5);
  if (stage > 1) {
    line(ctx,[[48,-27,height-6],[48,-20,height-21],[48,-28,height-36],[48,-17,height-46],[48,-24,10]].map(v=>p(...v)),'#465d58',2.6);
    face(ctx,p,[[-44,43,6],[-44,43,23],[-35,43,17],[-32,43,8],[-19,43,6]],'#7d7567');
    frontPanel(ctx,p,21,43.3,32,15,11,'#769684');
    line(ctx,[p(-5,43,height-11),p(2,43,height-22),p(-3,43,height-30),p(8,43,height-41)],'#5e6157',1.6);
  }
}

function drawBuilding(ctx, width, height, type, stage) {
  const p = localProject(ctx,width,height,ART_ANCHOR.building);
  ellipse(ctx,12,13,78,31,'rgba(40,72,56,.14)');
  ellipse(ctx,7,9,64,24,'rgba(40,72,56,.09)');
  box(ctx,p,-53,-48,0,106,96,5,['#dbcbae','#bfba9e','#f6e5c4']);
  if (type === 'shed') {
    box(ctx,p,-48,-43,5,96,86,42,['#d79a75','#b37d62','#f0b48b']);
    // Real boards on both walls, capped corners, a generous double barn door.
    for (let z=13;z<47;z+=10) {
      line(ctx,[p(-48,43.2,z),p(48,43.2,z)],'#b78060',1);
      line(ctx,[p(48.2,-43,z),p(48.2,43,z)],'#9c715b',1);
    }
    frontPanel(ctx,p,-21,43.4,5,43,34,'#946d52');
    frontPanel(ctx,p,-18,43.6,7,37,29,'#bd9b6c');
    line(ctx,[p(.5,44,7),p(.5,44,36)],'#765f4a',1.6);
    line(ctx,[p(-17,44,8),p(18,44,34)],'#ebd0a0',2.6);
    line(ctx,[p(18,44,8),p(-17,44,34)],'#ebd0a0',2.6);
    line(ctx,[p(-46,43.8,5),p(-46,43.8,44)],'#f1c397',4);
    line(ctx,[p(46,43.8,5),p(46,43.8,44)],'#f1c397',4);
    windowSide(ctx,p,48.4,-18,23,23,16,stage>1);
    roof(ctx,p,96,86,47,72,['#638c84','#4f766e','#81a697']);
    // Vent set into the gable.
    sidePanel(ctx,p,48.5,-6,49,12,9,'#806b58');
  } else if (type === 'kiosk') {
    box(ctx,p,-48,-43,5,96,86,72,['#e8977f','#cd786b','#f5b294']);
    box(ctx,p,-50,-45,74,100,90,9,['#eecb9e','#bd9d79','#ffe7ba']);
    box(ctx,p,-42,-37,83,84,74,4,['#db8d75','#b77164','#edaa8a']);
    // Shop glazing, door and tiled lower facade.
    frontPanel(ctx,p,-43,43.2,7,86,21,'#db826e');
    for(let x=-43;x<43;x+=16) line(ctx,[p(x,43.4,7),p(x,43.4,27)],'#efa38c',1.2);
    windowFront(ctx,p,-39,43.5,28,48,28,stage>1);
    frontPanel(ctx,p,20,43.5,7,20,49,'#f8e5c0');
    frontPanel(ctx,p,23,43.7,12,14,38,'#568d98');
    line(ctx,[p(25,44,16),p(25,44,46)],'#98c8cd',1.5);
    const handle = p(34,44,30); ellipse(ctx,handle.x,handle.y,1.2,1.8,'#ffe5a6');
    windowSide(ctx,p,48.3,-26,26,43,31,stage>1);
    // Striped canvas canopy projects over the pavement.
    const strips=8; const aw=-51; const awWidth=102/strips;
    for(let i=0;i<strips;i++) {
      const x=aw+i*awWidth;
      face(ctx,p,[[x,42,64],[x+awWidth,42,64],[x+awWidth,59,55],[x,59,55]],i%2?'#f8e5bd':'#d57264');
      frontPanel(ctx,p,x,59,49,awWidth,6,i%2?'#e9d9b4':'#bb5e58');
    }
    frontPanel(ctx,p,-35,44,68,70,10,'#477b70');
    ctx.save(); const sign=p(0,44.3,70); ctx.transform(SQRT3_2,.5,0,1,sign.x,sign.y);
    ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff3cc'; ctx.fillText('М А Р К Е Т',0,0); ctx.restore();
    // Small air-conditioning unit on the flat roof.
    box(ctx,p,-32,-26,87,23,20,10,['#bec8bb','#8eaaa1','#e3e6cd']);
    for(let x=-29;x<-12;x+=4) line(ctx,[p(x,-22,97.2),p(x,-10,97.2)],'#95aaa1',1.2);
  } else {
    box(ctx,p,-48,-43,5,96,86,106,['#8fbbac','#6e9f93','#bad8bf']);
    box(ctx,p,-50,-45,54,100,90,5,['#e7dfbb','#bdc4a7','#f5eaca']);
    frontPanel(ctx,p,-48,43.3,5,96,8,'#d8d4b5');
    sidePanel(ctx,p,48.3,-43,5,86,8,'#a8b69a');
    windowFront(ctx,p,-34,43.5,73,22,25,stage>1);
    windowFront(ctx,p,13,43.5,73,22,25,stage>1);
    windowFront(ctx,p,-35,43.5,23,22,22,false);
    windowSide(ctx,p,48.4,-29,74,22,24,stage>1);
    windowSide(ctx,p,48.4,12,74,22,24,false);
    windowSide(ctx,p,48.4,-26,25,25,23,stage>1);
    frontPanel(ctx,p,12,43.6,8,24,36,'#eddcbd');
    frontPanel(ctx,p,16,43.8,9,16,31,'#c88361');
    frontPanel(ctx,p,19,44,26,10,11,'#6a9ca3');
    const knob=p(29,44.3,21); ellipse(ctx,knob.x,knob.y,1.3,1.5,'#ffdf93');
    box(ctx,p,9,44,0,30,14,5,['#c6bea5','#9fa790','#e4dbc0']);
    // Window boxes, shutters and a warm terracotta roof.
    box(ctx,p,-36,44,67,27,6,5,['#b5795d','#8f6e54','#cad28f']);
    for(let x=-32;x<-10;x+=6) {
      const q=p(x,48,73); ellipse(ctx,q.x,q.y,2.8,2,'#d7a766');
    }
    roof(ctx,p,96,86,111,147,['#cc805d','#ad6652','#e8a376']);
    box(ctx,p,-26,-19,128,15,15,24,['#e5bea0','#ba967e','#f2d7b2']);
    box(ctx,p,-28,-21,151,19,19,3,['#cfa985','#a9876b','#efd6b2']);
    sidePanel(ctx,p,48.5,-9,117,18,9,'#46736d');
    line(ctx,[p(48.7,0,117),p(48.7,0,126)],'#d9d7b6',1.7);
  }
  cracks(ctx,p,type,stage);
  if(stage>0) {
    // A few displaced bricks make each damaged stage visibly different.
    box(ctx,p,38,44,0,8,6,5,['#d39a75','#b47c61','#e8b48a']);
    box(ctx,p,-25,50,0,7,5,3,['#c5916b','#a9795b','#e3b58a']);
  }
}

function industrialCracks(ctx,p,stage,width,height,depth=43) {
  if(!stage)return;
  line(ctx,[p(-width*.31,depth,height-6),p(-width*.18,depth,height-24),p(-width*.26,depth,height-35),p(-width*.1,depth,height-51),p(-width*.13,depth,17)],'#624f44',2.3);
  line(ctx,[p(-width*.18,depth,height-24),p(-width*.02,depth,height-26),p(width*.08,depth,height-16)],'#624f44',1.5);
  box(ctx,p,-40,48,0,13,9,6,['#b78a67','#916b53','#dcac82']);
  if(stage>1) {
    line(ctx,[p(width/2+.3,-24,height-12),p(width/2+.3,-16,height-29),p(width/2+.3,-24,height-42),p(width/2+.3,-9,10)],'#564e46',2.8);
    frontPanel(ctx,p,8,depth+.4,18,18,13,'#605a50');
    line(ctx,[p(8,depth+.6,18),p(26,depth+.6,31)],'#d7bc8b',3);
    box(ctx,p,13,49,0,17,11,8,['#af7e5c','#865f4b','#d2a37b']);
  }
}

function corrugatedContainer(ctx,p,x,y,z,w,d,h,colors,stage=0) {
  box(ctx,p,x,y,z,w,d,h,colors);
  for(let u=x+5;u<x+w-2;u+=8) {
    line(ctx,[p(u,y+d+.2,z+3),p(u,y+d+.2,z+h-3)],colors[1],1.5);
    line(ctx,[p(u+1.5,y+d+.25,z+3),p(u+1.5,y+d+.25,z+h-3)],colors[2],.8);
  }
  for(let v=y+5;v<y+d-2;v+=8)line(ctx,[p(x+w+.2,v,z+3),p(x+w+.2,v,z+h-3)],colors[0],1.6);
  for(let u=x+3;u<x+w;u+=9)line(ctx,[p(u,y+2,z+h+.2),p(u,y+d-2,z+h+.2)],colors[1],.8);
  sidePanel(ctx,p,x+w+.4,y+3,z+3,d-6,h-6,colors[1]);
  for(const v of [y+d*.28,y+d*.72]) {
    line(ctx,[p(x+w+.6,v,z+5),p(x+w+.6,v,z+h-5)],'#d8d7bd',1.5);
    line(ctx,[p(x+w+.8,v-2,z+11),p(x+w+.8,v+2,z+11)],'#fff0c6',2);
  }
  line(ctx,[p(x+w+.5,y+d/2,z+3),p(x+w+.5,y+d/2,z+h-3)],'#4d6d65',1.3);
  for(const u of [x+2,x+w-2])for(const v of [y+2,y+d-2])box(ctx,p,u-1,v-1,z+h,3,3,1.3,['#c3b79b','#8e9586','#e7d8b2']);
  if(stage)line(ctx,[p(x+12,y+d+.4,z+h-3),p(x+20,y+d+.4,z+h*.55),p(x+16,y+d+.4,z+6)],colors[1],3);
}

function drawIndustrialBuilding(ctx,width,height,type,stage) {
  const p=localProject(ctx,width,height,ART_ANCHOR.building);
  ellipse(ctx,11,13,78,30,'rgba(57,66,53,.15)');
  box(ctx,p,-55,-48,0,110,96,5,['#b7b39d','#969e8a','#e1d7b9']);
  if(type==='warehouse') {
    box(ctx,p,-50,-43,5,100,86,65,['#bc8066','#9b6758','#d8a27c']);
    // Mortar, piers and a working-height loading door make this a distinct factory.
    for(let z=12;z<69;z+=9) {
      line(ctx,[p(-50,43.2,z),p(50,43.2,z)],'#d7a58a',.8);
      line(ctx,[p(50.2,-43,z),p(50.2,43,z)],'#ba8972',.8);
      for(let x=-45+(z%18?0:7);x<49;x+=15)line(ctx,[p(x,43.3,z),p(x,43.3,z+8)],'#d7a58a',.7);
      for(let y=-39+(z%18?0:7);y<41;y+=15)line(ctx,[p(50.3,y,z),p(50.3,y,z+8)],'#ba8972',.7);
    }
    for(const x of [-50,-6,46])box(ctx,p,x,42,5,5,3,65,['#d9a386','#a97964','#f0c4a1']);
    frontPanel(ctx,p,-39,43.5,5,29,42,'#5b7c77');
    frontPanel(ctx,p,-36,43.8,7,23,36,'#6f9690');
    for(let z=11;z<43;z+=6)line(ctx,[p(-36,44,z),p(-13,44,z)],'#a4b8a3',1.2);
    windowFront(ctx,p,9,43.5,31,29,23,stage>1);
    windowSide(ctx,p,50.5,-29,31,21,23,stage>1);
    windowSide(ctx,p,50.5,7,31,21,23,stage>1);
    box(ctx,p,-54,43,0,49,15,5,['#9da698','#7b8c7e','#c7c7ab']);
    box(ctx,p,-53,-46,70,106,92,5,['#7b9290','#526f6d','#b1c3b4']);
    // Two angled roof lights and a chimney give the low roof a readable silhouette.
    for(const x of [-29,11]) {
      face(ctx,p,[[x,-29,75],[x+19,-29,75],[x+19,-2,89],[x,-2,89]],'#b4ddd5');
      face(ctx,p,[[x,-2,89],[x+19,-2,89],[x+19,16,75],[x,16,75]],'#688f8d');
      line(ctx,[p(x,-29,76),p(x,-2,90),p(x,16,76)],'#e0e4c8',2);
      line(ctx,[p(x+19,-29,76),p(x+19,-2,90),p(x+19,16,76)],'#e0e4c8',2);
      line(ctx,[p(x,-2,90),p(x+19,-2,90)],'#e0e4c8',2);
    }
    box(ctx,p,31,-38,75,12,14,35,['#c28c6b','#9d705a','#e1b28c']);
    box(ctx,p,29,-40,108,16,18,4,['#977e67','#746b5d','#c7b18c']);
    face(ctx,p,[[32,-37,112],[42,-37,112],[42,-24,112],[32,-24,112]],'#5f6255');
    frontPanel(ctx,p,-31,44,58,62,9,'#e4c689');
    ctx.save();const q=p(0,44.4,60);ctx.transform(SQRT3_2,.5,0,1,q.x,q.y);ctx.font='bold 7px sans-serif';ctx.textAlign='center';ctx.fillStyle='#6c6851';ctx.fillText('СКЛАД  •  02',0,0);ctx.restore();
    industrialCracks(ctx,p,stage,100,69);
  } else if(type==='tower') {
    // The whole brick tower is a single rooted sprite so the scene can tip it over.
    box(ctx,p,-41,-37,5,82,74,11,['#b2a88b','#8c9681','#d8c8a5']);
    box(ctx,p,-29,-28,16,58,56,141,['#bd866b','#996d5b','#dba786']);
    for(let z=22;z<155;z+=9) {
      line(ctx,[p(-29,28.2,z),p(29,28.2,z)],'#d5a68a',1);
      line(ctx,[p(29.2,-28,z),p(29.2,28,z)],'#b88b74',.9);
      for(let x=-26+(z%18?0:7);x<28;x+=14)line(ctx,[p(x,28.3,z),p(x,28.3,z+8)],'#d5a68a',.7);
      for(let y=-25+(z%18?0:7);y<28;y+=14)line(ctx,[p(29.3,y,z),p(29.3,y,z+8)],'#b88b74',.7);
    }
    for(const z of [51,103,153])box(ctx,p,-32,-31,z,64,62,5,['#c3b596','#939d86','#e1d1ae']);
    for(const z of [66,117]) {
      windowFront(ctx,p,-11,28.4,z,22,25,stage>0);
      windowSide(ctx,p,29.4,-10,z,20,25,stage>1);
    }
    frontPanel(ctx,p,-10,28.4,17,20,25,'#667a6a');
    line(ctx,[p(-6,29,19),p(-6,29,39)],'#92a58b',1.5);
    box(ctx,p,-35,-34,158,70,68,7,['#9b9f87','#737f70','#d5c6a4']);
    box(ctx,p,-28,-27,165,56,54,5,['#7e8b79','#5e7163','#a5b29a']);
    // Safety rails and a ladder remain drawn in the same world projection.
    for(const y of [-25,22]) {
      line(ctx,[p(34,y,20),p(34,y,152)],'#718177',2);
      for(let z=24;z<151;z+=11)line(ctx,[p(34,-25,z),p(34,22,z)],'#859387',1.7);
    }
    for(const x of [-32,0,32])line(ctx,[p(x,32,164),p(x,32,177)],'#7d8e7e',1.8);
    line(ctx,[p(-32,32,177),p(32,32,177)],'#9cae93',2);
    industrialCracks(ctx,p,stage,58,152,28.6);
  } else {
    // Interleaved colours and visible door hardware avoid a flat painted cube.
    corrugatedContainer(ctx,p,-48,-42,5,96,39,31,['#d39068','#b67355','#efba82'],stage);
    corrugatedContainer(ctx,p,-48,2,5,96,39,31,['#6e9e9a','#497d79','#a0c4b1'],stage);
    corrugatedContainer(ctx,p,-45,-22,36,90,43,31,['#d6b35d','#b18f45','#f3d184'],stage);
    frontPanel(ctx,p,-36,41.6,13,26,11,'#f4deb0');
    ctx.save();const q=p(-23,42,16);ctx.transform(SQRT3_2,.5,0,1,q.x,q.y);ctx.font='bold 6px sans-serif';ctx.textAlign='center';ctx.fillStyle='#617a6b';ctx.fillText('SC  104',0,0);ctx.restore();
    if(stage>1) {
      face(ctx,p,[[-45,21.4,40],[-24,21.4,51],[-32,21.4,65],[-45,21.4,65]],'#81754f');
      line(ctx,[p(-44,22,40),p(-32,22,64)],'#e7c276',3);
      box(ctx,p,35,45,0,12,8,4,['#879c88','#627d6e','#bbbc96']);
    }
  }
}

function rotatedPoint(angle, x, y, z) {
  return { x:x*Math.cos(angle)-y*Math.sin(angle), y:x*Math.sin(angle)+y*Math.cos(angle), z };
}
function vehicle(ctx, width, height, angle, treadPhase = 0) {
  ctx.translate(width/2,height-ART_ANCHOR.dozer);
  ellipse(ctx,3,7,55,23,'rgba(38,65,52,.16)');
  ellipse(ctx,0,4,42,17,'rgba(38,65,52,.1)');
  const faces=[];
  const world = (x,y,z) => rotatedPoint(angle,x,y,z);
  const project = v=>iso(v.x,v.y,v.z);
  const addFace=(vertices,fill,normal=null,detail=null)=> {
    if(normal) {
      const n=world(normal[0],normal[1],normal[2]);
      if(n.x+n.y+n.z<=0) return;
    }
    const points=vertices.map(v=>world(...v));
    faces.push({points,fill,detail,depth:points.reduce((sum,p)=>sum+p.x+p.y+p.z,0)/points.length});
  };
  const cube=(x,y,z,w,d,h,colors,details={})=>{
    const X=x+w,Y=y+d,Z=z+h;
    addFace([[x,y,z],[x,Y,z],[x,Y,Z],[x,y,Z]],colors[1],[-1,0,0],details.back);
    addFace([[X,Y,z],[X,y,z],[X,y,Z],[X,Y,Z]],colors[0],[1,0,0],details.front);
    addFace([[X,y,z],[x,y,z],[x,y,Z],[X,y,Z]],colors[1],[0,-1,0],details.left);
    addFace([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],colors[0],[0,1,0],details.right);
    addFace([[x,y,Z],[x,Y,Z],[X,Y,Z],[X,y,Z]],colors[2],[0,0,1],details.top);
  };
  const drawAtFace=(coordinates,fill)=>({coordinates,fill});
  const wheelDetail=(y)=>({draw:()=>{
    for(let x=-23;x<=23;x+=11.5) {
      const pts=[]; for(let i=0;i<12;i++) {const t=i*Math.PI/6;pts.push(project(world(x+5*Math.cos(t),y,9+5*Math.sin(t))));}
      polygon(ctx,pts,'#607067','#3d5149',1);
      const q=project(world(x,y,9)); ellipse(ctx,q.x,q.y,1.4,1.5,'#9da286');
    }
    for(let x=-24+treadPhase;x<29;x+=8) line(ctx,[project(world(x,y,16)),project(world(Math.min(x+2,29),y,14))],'#a2a38b',1.3);
  }});
  for(const y of [-28,18]) {
    cube(-30,y,3,60,10,14,['#48574e','#354b45','#69746a'],{left:wheelDetail(y-.1),right:wheelDetail(y+10.1)});
  }
  cube(-24,-18,13,49,36,13,['#e6aa32','#c68e29','#ffd769']);
  cube(-27,-17,26,23,34,11,['#eeb63a','#d89b2e','#ffdb70']);
  // Engine cooling slots on the rear deck.
  cube(-25,-13,37,15,26,.7,['#c5912d','#bb892c','#e9ad36'],{top:{draw:()=>{
    for(let x=-22;x<-11;x+=3.5) line(ctx,[project(world(x,-9,38)),project(world(x,9,38))],'#8c772e',1.3);
  }}});
  cube(-9,-15,26,27,30,7,['#f9c951','#d5a13a','#ffe28a']);
  cube(-9,-13,33,22,26,22,['#7ec3cf','#458e9f','#b2e5e6']);
  // Window reflection stripes are actual projected side planes.
  addFace([[-8,-13.2,48],[11,-13.2,48],[11,-13.2,51],[-8,-13.2,51]],'#bfe8e8',[0,-1,0]);
  addFace([[-8,13.2,48],[11,13.2,48],[11,13.2,51],[-8,13.2,51]],'#bfe8e8',[0,1,0]);
  addFace([[13.2,-11,47],[13.2,11,47],[13.2,11,51],[13.2,-11,51]],'#c8eff0',[1,0,0]);
  for(const x of [-11,11])for(const y of [-15,12]) cube(x,y,31,3,3,25,['#f2bb42','#d59d31','#ffda79']);
  cube(-14,-17,55,31,34,5,['#e9ad35','#c99530','#ffdb6d']);
  cube(-23,-12,37,4,4,18,['#53625a','#3b5049','#8a9581']);
  cube(-24,-13,55,6,6,2,['#4f6056','#3b5049','#7c8c77']);
  // Twin hydraulic arms carry the broad, faceted bucket.
  cube(17,-18,12,24,5,5,['#d6992e','#b07c27','#f6c55a']);
  cube(17,13,12,24,5,5,['#d6992e','#b07c27','#f6c55a']);
  const bladeBack=[[37,-32,6],[37,32,6],[46,32,24],[46,-32,24]];
  const bladeFront=[[43,-32,5],[43,32,5],[50,32,25],[50,-32,25]];
  addFace(bladeFront,'#ffd65e',[1,0,0]);
  addFace(bladeBack,'#cc962e',[-1,0,0]);
  addFace([[37,32,6],[43,32,5],[50,32,25],[46,32,24]],'#c28b2b',[0,1,0]);
  addFace([[43,-32,5],[37,-32,6],[46,-32,24],[50,-32,25]],'#e8b13d',[0,-1,0]);
  addFace([[46,-32,24],[46,32,24],[50,32,25],[50,-32,25]],'#ffe58c',[0,0,1]);
  cube(42,-33,3,4,66,4,['#a7aaa0','#808e82','#d5d4bb']);
  for(const y of [-14,10]) cube(21,y,24,3,4,5,['#fff6ca','#e7d593','#fffde4']);
  // Painted tow marking at the rear.
  cube(-28,-8,23,1,16,3,['#a87c2c','#966e26','#f1bb4a']);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces) {
    polygon(ctx,f.points.map(project),f.fill);
    if(f.detail?.draw) f.detail.draw();
  }
}

function machine(ctx,width,height,angle,id,treadPhase=0,attackFrame=null) {
  ctx.translate(width/2,height-ART_ANCHOR.machine);
  ellipse(ctx,2,8,55,22,'rgba(40,61,54,.16)');
  ellipse(ctx,0,6,43,16,'rgba(40,61,54,.09)');
  const world=(x,y,z)=>rotatedPoint(angle,x,y,z);
  const project=v=>iso(v.x,v.y,v.z);
  const at=(x,y,z)=>project(world(x,y,z));
  const faces=[];
  const addFace=(vertices,fill,normal=null,draw=null)=>{
    if(normal) {const n=world(...normal);if(n.x+n.y+n.z<=0)return;}
    const points=vertices.map(v=>world(...v));
    faces.push({points,fill,draw,depth:points.reduce((sum,p)=>sum+p.x+p.y+p.z,0)/points.length});
  };
  const addDraw=(x,y,z,draw)=>{
    const v=world(x,y,z);faces.push({draw,depth:v.x+v.y+v.z});
  };
  const cube=(x,y,z,w,d,h,c,details={})=>{
    const X=x+w,Y=y+d,Z=z+h;
    addFace([[x,y,z],[x,Y,z],[x,Y,Z],[x,y,Z]],c[1],[-1,0,0],details.back);
    addFace([[X,Y,z],[X,y,z],[X,y,Z],[X,Y,Z]],c[0],[1,0,0],details.front);
    addFace([[X,y,z],[x,y,z],[x,y,Z],[X,y,Z]],c[1],[0,-1,0],details.left);
    addFace([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],c[0],[0,1,0],details.right);
    addFace([[x,y,Z],[x,Y,Z],[X,Y,Z],[X,y,Z]],c[2],[0,0,1],details.top);
  };
  const beam=(a,b,thickness=8,span=9,colors=['#e3a43a','#b8792e','#ffd076'])=>{
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
    const ox=-dz/length*thickness/2,oz=dx/length*thickness/2;
    const side=y=>[[a[0]+ox,y,a[2]+oz],[b[0]+ox,y,b[2]+oz],[b[0]-ox,y,b[2]-oz],[a[0]-ox,y,a[2]-oz]];
    addFace(side(a[1]-span/2),colors[1],[0,-1,0]);
    addFace(side(a[1]+span/2),colors[0],[0,1,0]);
    addFace([[a[0]+ox,a[1]-span/2,a[2]+oz],[b[0]+ox,a[1]-span/2,b[2]+oz],[b[0]+ox,a[1]+span/2,b[2]+oz],[a[0]+ox,a[1]+span/2,a[2]+oz]],colors[2]);
    addFace([[a[0]-ox,a[1]-span/2,a[2]-oz],[b[0]-ox,a[1]-span/2,b[2]-oz],[b[0]-ox,a[1]+span/2,b[2]-oz],[a[0]-ox,a[1]+span/2,a[2]-oz]],colors[1]);
  };
  const pivot=(x,y,z,r=5)=>addDraw(x,y,z,()=>{
    const q=at(x,y,z);ellipse(ctx,q.x,q.y,r,r*.9,'#8c6e36');ellipse(ctx,q.x-1,q.y-1,r*.6,r*.55,'#efcd87');
  });
  const wheelDetail=y=>()=>{
    for(let x=-24;x<30;x+=11) {
      const ps=[];for(let k=0;k<12;k++){const t=k*Math.PI/6;ps.push(at(x+4.8*Math.cos(t),y,10+4.8*Math.sin(t)));}
      polygon(ctx,ps,'#65766a','#344d46',1);
      const q=at(x,y,10);ellipse(ctx,q.x,q.y,1.4,1.5,'#a3ad90');
    }
    for(let x=-29+treadPhase;x<30;x+=8)line(ctx,[at(x,y,17),at(Math.min(x+3,31),y,16)],'#a8ae97',1.4);
  };
  for(const y of [-28,18])cube(-32,y,3,64,10,15,['#465b52','#304b43','#738174'],{left:wheelDetail(y-.1),right:wheelDetail(y+10.1)});
  cube(-26,-21,17,51,42,10,['#e5a13e','#b87f31','#ffcd73']);
  cube(-20,-19,27,42,38,6,['#e6ae50','#bd8735','#ffdb8d']);
  const base=id==='wrecker'?['#63998f','#487a73','#9fc3a7']:['#ec9a40','#c77930','#ffc36e'];
  cube(-30,-19,30,22,38,17,base,{top:()=>{
    for(let x=-27;x<-12;x+=4)line(ctx,[at(x,-12,47.3),at(x,12,47.3)],id==='wrecker'?'#527e72':'#bc7933',1.2);
  }});
  // A real projected cab, safety bars and exhaust remain consistent in all eight directions.
  cube(-9,-19,33,25,24,5,['#f2aa49','#c88735','#ffd583']);
  cube(-8,-17,38,22,21,25,['#81c5ce','#4b94a3','#b9e8e2']);
  addFace([[-7,-17.2,55],[12,-17.2,55],[12,-17.2,60],[-7,-17.2,60]],'#c9ebe6',[0,-1,0]);
  addFace([[14.2,-15,54],[14.2,2,54],[14.2,2,60],[14.2,-15,60]],'#c9ebe6',[1,0,0]);
  for(const x of [-10,13])for(const y of [-19,3])cube(x,y,35,3,3,29,['#ef9f3f','#bb762e','#ffcb76']);
  cube(-13,-21,64,32,28,5,['#e9983b','#be7d30','#ffd27c']);
  cube(-24,11,47,4,4,15,['#586a5d','#3e554c','#96a18c']);
  cube(-25,10,61,6,6,2,['#526658','#3e554b','#a1ac92']);
  for(const y of [-18,14])cube(23,y,26,2,4,5,['#fff1be','#d9cc91','#ffffd9']);
  // Rear chevrons are geometry on the counterweight, not a screen-space sticker.
  for(const y of [-13,-3,7])addFace([[-30.3,y,32],[-30.3,y+5,32],[-30.3,y+10,43],[-30.3,y+5,43]],'#eed39a',[-1,0,0]);
  if(id==='excavator') {
    const poses=attackFrame===null?[82,36,38,83]:[
      [56,86,30,105],[88,65,48,99],[115,12,59,73],[94,25,43,79],[82,36,38,83],
    ][attackFrame];
    const [tx,tz,ex,ez]=poses;
    const shoulder=[10,11,40],elbow=[ex,11,ez],wrist=[tx-20,11,tz+13];
    // Two articulated segments, chrome rams and a toothed bucket.
    beam(shoulder,elbow,12,12);beam(elbow,wrist,9,10);
    beam([7,19,42],[ex-7,19,ez-5],3,3,['#9eaaa0','#697e72','#d5d8bd']);
    beam([ex-4,18,ez-6],[tx-20,18,tz+16],2.5,3,['#ced2bd','#8b9d8e','#f3eed4']);
    for(const [x,y,z] of [shoulder,elbow,wrist])pivot(x,y+7,z,4);
    const back=tx-23,top=tz+17;
    addFace([[back,0,top],[back,23,top],[tx,23,tz],[tx,0,tz]],'#e7ad4d',[0,0,1]);
    addFace([[back,23,top],[tx,23,tz],[tx-4,23,tz-8],[back-2,23,tz-3]],'#b37832',[0,1,0]);
    addFace([[back,0,top],[tx,0,tz],[tx-4,0,tz-8],[back-2,0,tz-3]],'#ca8f3c',[0,-1,0]);
    addFace([[back-2,0,tz-3],[back-2,23,tz-3],[tx-4,23,tz-8],[tx-4,0,tz-8]],'#705f40');
    for(const y of [1,7,13,19])cube(tx-3,y,tz-6,7,3,3,['#b2b5a0','#7d8c7c','#ebe5c5']);
    addDraw(tx,11,0,()=>{if(attackFrame===2){const q=at(tx,11,0);ellipse(ctx,q.x,q.y,18,7,'rgba(60,71,54,.12)');}});
  } else {
    const poses=attackFrame===null?[82,36,0]:[
      [-8,93,-23],[72,79,-10],[125,24,0],[98,31,0],[82,36,0],
    ][attackFrame];
    const [bx,bz,by]=poses;
    const tip=[54,8,111];
    beam([7,8,37],tip,13,15,['#dea64e','#aa7938','#ffd48a']);
    // A triangular lattice boom, with its chrome lift cylinder beneath it.
    for(let i=0;i<4;i++) {
      const t=i/4,u=(i+1)/4;
      const ax=7+47*t,az=37+74*t,cx=7+47*u,cz=37+74*u;
      beam([ax,16,az+3],[cx,16,cz-4],2,2,['#876b3c','#6d5c37','#e5bf78']);
    }
    beam([15,20,31],[43,20,85],4,5,['#9ca995','#6c8173','#d9d8bd']);
    cube(-22,7,49,18,10,10,['#62867b','#466b61','#9eac8e']);
    addDraw((tip[0]+bx)/2,(tip[1]+by)/2,(tip[2]+bz)/2,()=>{
      const a=at(...tip),b=at(bx,by,bz+19);
      line(ctx,[a,b],'#45594f',4);line(ctx,[{x:a.x-1,y:a.y},{x:b.x-1,y:b.y}],'#b1b7a1',1.3);
      const len=Math.hypot(b.x-a.x,b.y-a.y);const links=Math.min(16,Math.max(4,Math.floor(len/8)));
      for(let i=1;i<links;i++){const t=i/links;const q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};ellipse(ctx,q.x,q.y,2,2.8,i%2?'#7f9282':'#aab29b');}
    });
    // The ball remains a round steel volume, while its centre follows rotated world coordinates.
    addDraw(bx,by,bz,()=>{
      const q=at(bx,by,bz),r=24;
      const g=ctx.createRadialGradient(q.x-9,q.y-10,2,q.x+3,q.y+3,r+4);
      g.addColorStop(0,'#aabbb1');g.addColorStop(.35,'#738c81');g.addColorStop(.75,'#48675d');g.addColorStop(1,'#2e4c46');
      ellipse(ctx,q.x,q.y,r,r,g);
      ctx.save();ctx.beginPath();ctx.ellipse(q.x,q.y,r,r,0,0,Math.PI*2);ctx.clip();
      ctx.strokeStyle='#38564d';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(q.x+1,q.y,10,24,-.35,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#b0bdab';ctx.globalAlpha=.55;ctx.beginPath();ctx.ellipse(q.x,q.y-2,25,9,.3,0,Math.PI);ctx.stroke();ctx.restore();
      ellipse(ctx,q.x-8,q.y-10,6,3,'rgba(218,227,204,.6)');
      const sh=at(bx,by,0);if(bz<45)ellipse(ctx,sh.x,sh.y,23,8,'rgba(43,64,53,.13)');
    });
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces){if(f.points)polygon(ctx,f.points.map(project),f.fill);if(f.draw)f.draw();}
}

function rubble(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.building);
  ellipse(ctx,5,8,65,26,'rgba(70,77,56,.12)');
  face(ctx,p,[[-45,-36,0],[44,-36,0],[47,35,0],[-40,39,0]],'#b1af91');
  const bricks=[[-30,-24,20,12,6],[-9,-29,21,14,9],[17,-18,17,12,7],[-39,0,16,12,10],[-13,-2,24,16,14],[17,6,20,13,9],[-22,22,17,12,6],[4,28,19,9,6],[29,27,15,11,4]];
  for(const [x,y,bw,bd,bh] of bricks) box(ctx,p,x,y,1,bw,bd,bh,['#d7ab86','#b58d70','#edc79e']);
  face(ctx,p,[[-7,-16,13],[24,-8,14],[18,16,19],[-11,9,16]],'#bd815f');
  line(ctx,[p(-21,24,9),p(17,-8,23)],'#ded1ab',5);
}

function tree(ctx,w,h,variant=0) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,3,5,30,13,'rgba(48,90,63,.13)');
  box(ctx,p,-4,-4,0,8,8,48,['#b58a63','#8f7355','#cda47a']);
  const crowns=variant ? [[0,-48,22,29],[-14,-57,21,27],[14,-58,23,28],[1,-77,24,26]] : [[0,-44,28,24],[-15,-62,24,23],[15,-67,25,25],[0,-85,23,23]];
  for(const [x,y,rx,ry] of crowns) {
    ellipse(ctx,x+3,y+4,rx,ry,'#639c76');
    ellipse(ctx,x-2,y-2,rx-1,ry-2,variant?'#8cbc86':'#83b886');
    ellipse(ctx,x-7,y-8,rx*.5,ry*.39,variant?'#a8ce94':'#a4cc94');
  }
  const q=p(0,0,30); line(ctx,[q,{x:q.x+9,y:q.y-14}],'#a7835c',4);
}
function shrub(ctx,w,h) {
  localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,3,23,9,'rgba(48,90,63,.12)');
  for(const [x,y,r] of [[-13,-7,13],[2,-13,16],[15,-8,12]]) {
    ellipse(ctx,x+2,y+3,r,r*.67,'#599375');
    ellipse(ctx,x,y,r,r*.67,'#87b98a');
    ellipse(ctx,x-3,y-3,r*.53,r*.32,'#a8cd95');
  }
}
function lamp(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,7,5,14,5,'rgba(47,73,58,.12)');
  box(ctx,p,-5,-5,0,10,10,4,['#798d7c','#5f786d','#9aad95']);
  line(ctx,[p(0,0,3),p(0,0,79),p(0,-9,84)],'#647b70',4);
  const q=p(0,-11,82);
  ellipse(ctx,q.x,q.y,9,4,'#49685e');
  ellipse(ctx,q.x,q.y+2,7,3,'#f6e7b5');
  line(ctx,[p(0,0,71),p(0,-9,78)],'#647b70',1.6);
}
function cone(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,3,10,4,'rgba(47,73,58,.1)');
  box(ctx,p,-7,-7,0,14,14,2,['#e6a475','#c2835f','#ffbd8b']);
  face(ctx,p,[[-5,-5,2],[5,-5,2],[1,1,21]],'#e49b5e');
  face(ctx,p,[[-5,5,2],[5,5,2],[1,1,21]],'#f6a76c');
  face(ctx,p,[[5,-5,2],[5,5,2],[1,1,21]],'#ce7f50');
  face(ctx,p,[[-2.5,3.8,10],[3.8,3.8,10],[2.6,2.6,14],[-.8,2.6,14]],'#fff0cf');
}
function fence(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,2,4,34,10,'rgba(47,73,58,.08)');
  for(const x of [-30,-15,0,15,30]) box(ctx,p,x,-2,0,4,4,27,['#e9d7b6','#c5b997','#fae8c7']);
  box(ctx,p,-32,-1,8,67,3,4,['#e9d7b6','#c5b997','#fff0d2']);
  box(ctx,p,-32,-1,21,67,3,4,['#e9d7b6','#c5b997','#fff0d2']);
}
function bench(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,3,5,33,12,'rgba(47,73,58,.1)');
  for(const x of [-23,19]) box(ctx,p,x,-5,0,4,15,13,['#648777','#466b5f','#8ba38a']);
  for(const y of [-7,-1,5]) box(ctx,p,-29,y,13,58,5,3,['#cfa774','#ac895e','#e8c38b']);
  box(ctx,p,-27,-8,16,3,3,21,['#648777','#466b5f','#8ba38a']);
  box(ctx,p,24,-8,16,3,3,21,['#648777','#466b5f','#8ba38a']);
  box(ctx,p,-29,-9,23,58,4,7,['#cfa774','#ac895e','#e8c38b']);
  box(ctx,p,-29,-9,32,58,4,5,['#cfa774','#ac895e','#e8c38b']);
}
function car(ctx,w,h,color) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,0,5,37,13,'rgba(47,73,58,.14)');
  for(const x of [-24,16])for(const y of [-17,11]) box(ctx,p,x,y,1,9,6,11,['#40554e','#324a43','#62746a']);
  box(ctx,p,-32,-15,7,65,30,12,[color,'#ad786b','#edbba0']);
  box(ctx,p,-15,-13,19,31,26,16,['#83bdc5','#5c959e','#c1e1dc']);
  box(ctx,p,-18,-15,35,35,30,3,[color,'#ad786b','#edbba0']);
  for(const y of [-13,8])box(ctx,p,32,y,13,1,5,4,['#fff0c1','#e6d497','#ffefb4']);
  line(ctx,[p(-29,15.3,10),p(29,15.3,10)],'#f2d4bb',1.3);
}

function industrialBarrels(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,4,4,29,12,'rgba(48,69,57,.14)');
  for(const [x,y,color] of [[-9,-9,'#b77f5d'],[12,5,'#7c9e91'],[-13,14,'#cb9e56']]) {
    box(ctx,p,x-8,y-8,0,16,16,25,[color,'#677d69','#b5bc96']);
    for(const z of [5,20]) {
      line(ctx,[p(x-8,y+8,z),p(x+8,y+8,z),p(x+8,y-8,z)],'#d3c7a0',2);
    }
    const q=p(x,y,26);ellipse(ctx,q.x,q.y,9.5,4.8,'#c2bea0');ellipse(ctx,q.x,q.y,7.5,3.4,color);
    const cap=p(x+3,y,26.4);ellipse(ctx,cap.x,cap.y,1.4,1,'#526b5a');
  }
}
function industrialPallet(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,3,4,35,14,'rgba(48,69,57,.12)');
  for(const y of [-18,0,17])box(ctx,p,-27,y,0,54,5,5,['#b89565','#937b56','#dabb83']);
  for(let x=-27;x<28;x+=9)box(ctx,p,x,-20,5,7,43,3,['#d0aa73','#a28c61','#e5c897']);
  box(ctx,p,-19,-14,8,27,27,24,['#c29e71','#987e5b','#e4c28c']);
  for(const y of [-14,13])line(ctx,[p(-18,y,10),p(7,y,31)],'#e9cda0',2);
  line(ctx,[p(-18,13,31),p(7,13,10)],'#a3865c',2.2);
  box(ctx,p,8,-13,8,16,22,17,['#8caa99','#668675','#b7c5a7']);
}
function industrialFence(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,2,4,42,11,'rgba(48,69,57,.08)');
  for(let x=-37;x<38;x+=9) {
    line(ctx,[p(x,0,4),p(Math.min(x+29,39),0,34)],'#8fa18a',.8);
    line(ctx,[p(x,0,34),p(Math.min(x+29,39),0,4)],'#8fa18a',.8);
  }
  for(const x of [-40,38])box(ctx,p,x,-2,0,4,4,40,['#718c7c','#526f61','#a8b69b']);
  line(ctx,[p(-38,0,35),p(40,0,35)],'#a4b39a',2.4);
  line(ctx,[p(-38,0,4),p(40,0,4)],'#819985',2);
}
function industrialCrane(ctx,w,h) {
  const p=localProject(ctx,w,h,ART_ANCHOR.decor);
  ellipse(ctx,6,8,56,20,'rgba(48,69,57,.1)');
  box(ctx,p,-22,-21,0,44,42,8,['#a6aa91','#7c9381','#d6c7a3']);
  for(const [x,y] of [[-12,-12],[-12,10],[10,-12],[10,10]])box(ctx,p,x,y,8,3,3,174,['#c29c51','#a08443','#e6c57d']);
  for(let z=16;z<178;z+=21) {
    line(ctx,[p(-11,13,z),p(11,13,z+20),p(-11,13,z+20)],'#d5b168',3);
    line(ctx,[p(13,-11,z),p(13,11,z+20),p(13,-11,z+20)],'#ae934f',2.7);
  }
  box(ctx,p,-118,-14,177,182,28,6,['#d6ac58','#b38f44','#f1d28a']);
  for(let x=-117;x<63;x+=22) {
    line(ctx,[p(x,14,183),p(x+11,14,196),p(x+22,14,183)],'#d2ad60',3);
    line(ctx,[p(x,-14,183),p(x+11,-14,196),p(x+22,-14,183)],'#b28e49',2);
  }
  line(ctx,[p(-118,14,196),p(64,14,196)],'#e6c67d',3);
  box(ctx,p,34,-16,175,29,32,18,['#789486','#58786d','#a9b8a0']);
  box(ctx,p,-23,-16,160,24,32,19,['#e1b461','#b68e45','#f0cf86']);
  frontPanel(ctx,p,-20,16.3,165,18,10,'#7bb7bd');
  line(ctx,[p(-98,0,181),p(-98,0,97)],'#677c6d',2);
  line(ctx,[p(-98,0,97),p(-98,0,89),p(-93,0,87),p(-89,0,91)],'#596f61',3);
}

function garageRoom(ctx) {
  // A quiet workshop backdrop; the selected machine is animated by the scene.
  const glow=ctx.createRadialGradient(600,330,50,600,390,680);
  glow.addColorStop(0,'#e6edd7');glow.addColorStop(1,'#9ebaa5');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,800);
  ctx.translate(600,450);const p=iso;
  ellipse(ctx,4,160,476,163,'rgba(42,75,61,.12)');
  face(ctx,p,[[-310,-230,-14],[310,-230,-14],[310,230,-14],[-310,230,-14]],'#9daa91');
  face(ctx,p,[[-310,-230,0],[310,-230,0],[310,230,0],[-310,230,0]],'#c4c5a9');
  for(let x=-310;x<310;x+=62)for(let y=-230;y<230;y+=58) {
    face(ctx,p,[[x,y,0],[x+60,y,0],[x+60,y+56,0],[x,y+56,0]],((x+y)/2)%3?'#d6d1b3':'#dcd7ba');
  }
  face(ctx,p,[[-310,-230,0],[-310,230,0],[-310,230,170],[-310,-230,170]],'#8eaa97');
  face(ctx,p,[[-310,-230,0],[310,-230,0],[310,-230,170],[-310,-230,170]],'#a9bda4');
  for(let z=24;z<170;z+=23) {
    line(ctx,[p(-309,-230,z),p(-309,230,z)],'#9cb4a0',1);
    line(ctx,[p(-310,-229,z),p(310,-229,z)],'#b9c7ad',1);
  }
  line(ctx,[p(-310,230,0),p(-310,-230,0),p(310,-230,0)],'#708e7c',8);
  line(ctx,[p(-310,230,170),p(-310,-230,170),p(310,-230,170)],'#e4dfbd',9);
  for(const x of [-285,-35,280])box(ctx,p,x,-230,0,12,14,170,['#98a78c','#718e77','#d5d7b3']);
  for(const y of [-50,190])box(ctx,p,-310,y,0,14,10,170,['#98a78c','#718e77','#d5d7b3']);
  // An inset rolling door, with daylight visible in its high panels.
  frontPanel(ctx,p,44,-228,1,181,134,'#738d7d','#ced1af',4);
  for(let z=8;z<131;z+=12)line(ctx,[p(49,-227,z),p(220,-227,z)],'#8fa28a',2);
  for(const x of [62,114,166])frontPanel(ctx,p,x,-226,98,41,23,'#b7ddd2','#d9dfbc',2);
  line(ctx,[p(123,-226,35),p(148,-226,35)],'#d2caaa',4);
  // Tool board and a timber workbench are fitted to the left wall.
  sidePanel(ctx,p,-308,-111,65,143,63,'#bf9d69','#dfc494',3);
  for(let y=-104;y<29;y+=13)for(let z=72;z<126;z+=12) {const q=p(-307.5,y,z);ellipse(ctx,q.x,q.y,.9,.9,'#937e57');}
  for(const [y,z] of [[-87,111],[-60,104],[-30,116],[-6,102]]) {
    line(ctx,[p(-305,y,z),p(-305,y+8,z-25)],'#778b7b',4);
    line(ctx,[p(-305,y-4,z),p(-305,y+7,z+2)],'#c8ccad',4);
  }
  for(const y of [-115,24])box(ctx,p,-294,y,0,31,8,52,['#9a845f','#7d7054','#c3aa7b']);
  box(ctx,p,-302,-124,49,53,160,7,['#c09561','#987b53','#e2bd83']);
  for(const y of [-99,-37])box(ctx,p,-298,y,14,40,48,30,['#6c9c8d','#4f7b6b','#a5bb9a']);
  box(ctx,p,-292,-105,56,18,32,7,['#bc7959','#98634e','#e2a277']);
  box(ctx,p,-281,-39,56,20,20,10,['#788b7b','#536f61','#b7bca0']);
  // Storage shelves, spare barrels and a striped service bay.
  for(const x of [-248,-104])for(const y of [-213,-176])box(ctx,p,x,y,0,5,5,120,['#7a927d','#5b7765','#aeb99a']);
  for(const z of [15,61,109])box(ctx,p,-248,-214,z,149,44,5,['#839981','#617d68','#b1b99a']);
  for(const [x,z,c] of [[-227,20,'#c6a174'],[-171,20,'#84a28c'],[-224,66,'#b28d64'],[-169,66,'#d1ae70']])box(ctx,p,x,-204,z,39,25,32,[c,'#8b795a','#ddc596']);
  for(const x of [-171,161]) {
    line(ctx,[p(x,-62,.2),p(x,142,.2)],'#f8e1a4',6);
    for(let y=-65;y<141;y+=25)face(ctx,p,[[x-9,y,.4],[x+9,y+12,.4],[x+9,y+22,.4],[x-9,y+10,.4]],'#c5aa65');
  }
  line(ctx,[p(-171,-62,.2),p(161,-62,.2)],'#efd498',5);
  line(ctx,[p(-171,142,.2),p(161,142,.2)],'#efd498',5);
  // Soft pools of light and two suspended workshop lamps.
  for(const [x,y] of [[-170,-170],[190,-170]]) {
    const g=p(x,y,0);ellipse(ctx,g.x,g.y,84,37,'rgba(255,245,197,.10)');
    line(ctx,[p(x,y,170),p(x,y,148)],'#657f6b',2.5);
    box(ctx,p,x-30,y-9,144,60,18,7,['#648571','#496a59','#adc1a0']);
    face(ctx,p,[[x-26,y-7,143],[x+26,y-7,143],[x+26,y+7,143],[x-26,y+7,143]],'#fff1b9');
  }
  frontPanel(ctx,p,-25,-226,99,57,34,'#527b69','#d2c79e',3);
  ctx.save();const q=p(3,-225,110);ctx.transform(SQRT3_2,.5,0,1,q.x,q.y);ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f5e5b7';ctx.fillText('SMASH',0,0);ctx.fillText('WORKSHOP',0,12);ctx.restore();
  // Foreground corners stay open for controls in the HTML garage layout.
  for(const [x,y] of [[226,116],[252,157]]) {
    box(ctx,p,x-8,y-8,0,16,16,2,['#e8a46b','#c18051','#ffc38a']);
    face(ctx,p,[[x-6,y+6,2],[x+6,y+6,2],[x,y,26]],'#e79a57');
    face(ctx,p,[[x+6,y-6,2],[x+6,y+6,2],[x,y,26]],'#bf793e');
    line(ctx,[p(x-3,y+3,12),p(x+3,y+3,12)],'#fff2cd',3);
  }
}

function garageVehiclePortrait(scene,id) {
  const source=scene.textures.get(`${id}-0`).getSourceImage();
  const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
  let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++) {
    if(pixels[(y*source.width+x)*4+3]<8)continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const sw=right-left+1,sh=bottom-top+1;
  // UI-only framing removes the transparent attack margin; world textures retain
  // their exact common anchor so selecting another vehicle cannot move its feet.
  texture(scene,`garage-${id}`,320,280,(ctx)=>{
    const scale=Math.min(280/sw,244/sh);
    ctx.drawImage(source,left,top,sw,sh,(320-sw*scale)/2,(280-sh*scale)/2,sw*scale,sh*scale);
  });
}

export function createTextures(scene) {
  for(const type of ['shed','kiosk','house'])for(let stage=0;stage<3;stage++) {
    texture(scene,`${type}-${stage}`,256,292,(ctx,w,h)=>drawBuilding(ctx,w,h,type,stage));
  }
  texture(scene,'rubble',256,292,rubble);
  for(const type of ['warehouse','tower','containers'])for(let stage=0;stage<3;stage++) {
    texture(scene,`${type}-${stage}`,256,292,(ctx,w,h)=>drawIndustrialBuilding(ctx,w,h,type,stage));
  }
  for(let i=0;i<8;i++) {
    texture(scene,`dozer-${i}`,180,160,(ctx,w,h)=>vehicle(ctx,w,h,i*Math.PI/4));
    texture(scene,`dozer-${i}-moving`,180,160,(ctx,w,h)=>vehicle(ctx,w,h,i*Math.PI/4,4));
    for(const id of ['excavator','wrecker']) {
      texture(scene,`${id}-${i}`,360,320,(ctx,w,h)=>machine(ctx,w,h,i*Math.PI/4,id));
      texture(scene,`${id}-${i}-moving`,360,320,(ctx,w,h)=>machine(ctx,w,h,i*Math.PI/4,id,4));
      for(let frame=0;frame<5;frame++)texture(scene,`${id}-${i}-attack-${frame}`,360,320,(ctx,w,h)=>machine(ctx,w,h,i*Math.PI/4,id,0,frame));
    }
  }
  texture(scene,'dust',48,48,(ctx)=>{
    const g=ctx.createRadialGradient(24,24,2,24,24,22);g.addColorStop(0,'rgba(248,231,190,.8)');g.addColorStop(.45,'rgba(234,218,181,.45)');g.addColorStop(1,'rgba(234,218,181,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,48,48);
  });
  texture(scene,'chip',20,20,(ctx)=>{
    polygon(ctx,[{x:3,y:6},{x:11,y:2},{x:18,y:7},{x:17,y:14},{x:9,y:18},{x:3,y:13}],'#bf8c68');
    polygon(ctx,[{x:3,y:6},{x:11,y:2},{x:18,y:7},{x:10,y:11}],'#f0c29a');
    polygon(ctx,[{x:10,y:11},{x:18,y:7},{x:17,y:14},{x:9,y:18}],'#d9a579');
  });
  texture(scene,'coin',32,36,(ctx)=>{
    ellipse(ctx,16,20,12,13,'#c98f31');ellipse(ctx,16,16,12,13,'#ffe17a');ellipse(ctx,16,16,9,10,'#f5b63d');
    ctx.strokeStyle='#ffdf71';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(16,16,8,9,0,0,Math.PI*2);ctx.stroke();
    line(ctx,[{x:17,y:10},{x:13,y:14},{x:19,y:18},{x:15,y:22}],'#fff0a7',2.5);
    ellipse(ctx,12,9,3,2,'#fff4bd');
  });
  texture(scene,'spark',32,32,(ctx)=>polygon(ctx,[{x:16,y:1},{x:20,y:12},{x:31,y:16},{x:20,y:20},{x:16,y:31},{x:12,y:20},{x:1,y:16},{x:12,y:12}],'#fff0ad'));
  texture(scene,'tree-a',160,180,(ctx,w,h)=>tree(ctx,w,h,0));
  texture(scene,'tree-b',160,180,(ctx,w,h)=>tree(ctx,w,h,1));
  texture(scene,'shrub',100,90,shrub);
  texture(scene,'lamp',100,150,lamp);
  texture(scene,'cone',64,76,cone);
  texture(scene,'fence',130,105,fence);
  texture(scene,'bench',140,115,bench);
  texture(scene,'car-coral',160,140,(ctx,w,h)=>car(ctx,w,h,'#d99581'));
  texture(scene,'car-blue',160,140,(ctx,w,h)=>car(ctx,w,h,'#8cbbb4'));
  texture(scene,'industrial-barrels',140,130,industrialBarrels);
  texture(scene,'industrial-pallet',150,125,industrialPallet);
  texture(scene,'industrial-fence',160,120,industrialFence);
  texture(scene,'industrial-crane',440,360,industrialCrane);
  texture(scene,'garage-room',1200,800,garageRoom);
  for(const id of ['dozer','excavator','wrecker'])garageVehiclePortrait(scene,id);
}

function worldPolygon(ctx,coordinates,fill,stroke=null,width=1) {
  polygon(ctx,coordinates.map(([x,y,z=0])=>iso(x,y,z)),fill,stroke,width);
}
function worldLine(ctx,coordinates,color,width=1) {
  line(ctx,coordinates.map(([x,y,z=0])=>iso(x,y,z)),color,width);
}
function worldRect(ctx,x,y,w,d,fill) {
  worldPolygon(ctx,[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],fill);
}

function drawIndustrialGround(scene) {
  texture(scene,'smash-ground-industrial',1900,1190,(ctx)=>{
    ctx.translate(950,62);
    const corners=[[0,0],[1000,0],[1000,1000],[0,1000]];
    ctx.save();ctx.shadowColor='rgba(52,78,66,.20)';ctx.shadowBlur=26;ctx.shadowOffsetY=29;
    worldPolygon(ctx,corners,'#839e88');ctx.restore();
    worldPolygon(ctx,[[0,1000,0],[1000,1000,0],[1000,1000,-25],[0,1000,-25]],'#899c80');
    worldPolygon(ctx,[[1000,0,0],[1000,1000,0],[1000,1000,-25],[1000,0,-25]],'#738e78');
    worldPolygon(ctx,corners,'#b5bea2');
    worldRect(ctx,14,14,972,972,'#d4d1b3');
    // The northern row is one continuous factory yard: its three close structures
    // sit on concrete, so no painted road passes underneath the tutorial chain.
    worldRect(ctx,111,113,778,136,'#aeb5a1');
    worldRect(ctx,116,118,768,126,'#c5c5a9');
    const sites=[[180,180],[340,180],[500,180],[760,180]];
    for(const y of [400,620,840])for(const x of [180,400,620,840])sites.push([x,y]);
    for(const [x,y] of sites) {
      worldRect(ctx,x-69,y-63,138,126,'#a5ae96');
      worldRect(ctx,x-63,y-57,126,114,'#c8c6a8');
      worldRect(ctx,x-53,y-48,106,96,'#b4b99c');
      for(let u=-63;u<64;u+=16) {
        worldLine(ctx,[[x+u,y+57],[x+u+7,y+63]],'#e5cc87',3);
        worldLine(ctx,[[x+63,y+u*.8],[x+69,y+u*.8+5]],'#e5cc87',2.2);
      }
      worldLine(ctx,[[x-63,y-13],[x-49,y-9],[x-44,y+2]],'#b2b298',.8);
    }
    const roads=[65,290,510,730,950];
    for(const r of roads) {
      worldRect(ctx,10,r-51,980,102,'#e0d9b5');
      worldRect(ctx,r-51,r===65||r===950?10:290,102,r===65||r===950?980:700,'#e0d9b5');
    }
    for(const r of roads) {
      worldRect(ctx,12,r-44,976,88,'#72867f');
      worldRect(ctx,r-44,r===65||r===950?12:290,88,r===65||r===950?976:698,'#72867f');
    }
    const inJunction=v=>roads.some(r=>Math.abs(v-r)<58);
    for(const r of roads)for(let s=14;s<980;s+=37) {
      if(inJunction(s))continue;
      worldRect(ctx,s,r-1,17,2,'#dcd8b4');
      if(s>290||r===65||r===950)worldRect(ctx,r-1,s,2,17,'#dcd8b4');
    }
    // Wheel streaks, drains and concrete joints are baked once into the ground.
    for(let i=0;i<38;i++) {
      const x=120+(i*131)%760,y=116+(i*79)%130;
      worldLine(ctx,[[x,y],[x+15,y+10],[x+22,y+7]],'#b7baa0',.8);
    }
    for(const y of [119,240])for(let x=124;x<882;x+=57)worldLine(ctx,[[x,y],[x,y===119?240:119]],'#b8b99e',.7);
    for(const r of [290,510,730])for(const x of [133,353,573,793]) {
      worldRect(ctx,x,r-49,18,5,'#72877a');
      for(let z=2;z<18;z+=3)worldLine(ctx,[[x+z,r-49],[x+z,r-44]],'#abb8a0',.8);
      worldLine(ctx,[[x+40,r+18],[x+77,r+20]],'#697d73',1);
      worldLine(ctx,[[x+40,r+26],[x+77,r+28]],'#697d73',1);
    }
    // A small rail siding at the rear reads as industrial infrastructure.
    for(const y of [24,36])worldLine(ctx,[[130,y],[875,y]],'#6f8271',2.8);
    for(let x=133;x<875;x+=17)worldLine(ctx,[[x,18],[x,42]],'#a49a77',3.4);
    // Loading bay at the southwest corner, kept separate from destructible sites.
    worldRect(ctx,117,774,128,123,'#b7baa0');
    for(let x=121;x<244;x+=18)worldLine(ctx,[[x,777],[Math.min(x+31,246),802]],'#dfc386',5);
    worldRect(ctx,128,815,106,65,'#d1ccb0');
    for(let i=0;i<30;i++) {
      const p=iso(8,14+i*33);ellipse(ctx,p.x,p.y,3,1.2,'#a3b292');
      const q=iso(18+i*32,992);ellipse(ctx,q.x,q.y,3,1.2,'#97a989');
    }
    worldLine(ctx,[[0,1000],[1000,1000],[1000,0]],'#d7d3b0',2);
  });
  return scene.add.image(-950,-62,'smash-ground-industrial').setOrigin(0,0).setDepth(-10000);
}

export function drawGround(scene,district='town') {
  if(district==='industrial')return drawIndustrialGround(scene);
  texture(scene,'smash-ground',1900,1190,(ctx)=>{
    ctx.translate(950,62);
    // A little floating diorama; its exposed edge remains visible at camera limits.
    const corners=[[0,0],[1000,0],[1000,1000],[0,1000]];
    ctx.save();ctx.shadowColor='rgba(54,96,79,.20)';ctx.shadowBlur=26;ctx.shadowOffsetY=29;
    worldPolygon(ctx,corners,'#89b895');ctx.restore();
    worldPolygon(ctx,[[0,1000,0],[1000,1000,0],[1000,1000,-25],[0,1000,-25]],'#84b393');
    worldPolygon(ctx,[[1000,0,0],[1000,1000,0],[1000,1000,-25],[1000,0,-25]],'#6fa487');
    worldPolygon(ctx,corners,C.grass);
    // Pale perimeter margin and discrete painted paving around every block.
    worldRect(ctx,14,14,972,972,'#b3d4b4');
    const centers=[180,400,620,840];
    centers.forEach((x,ix)=>centers.forEach((y,iy)=>{
      const park=(ix===3&&iy===0)||(ix===0&&iy===3);
      worldRect(ctx,x-73,y-73,146,146,'#e3d9b9');
      worldRect(ctx,x-64,y-64,128,128,park?'#aed0a1':'#eae0c2');
      if(park) {
        worldRect(ctx,x-57,y-57,114,114,'#a6c99b');
        worldRect(ctx,x-6,y-63,12,126,'#e3d9b9');
        worldRect(ctx,x-63,y-6,126,12,'#e3d9b9');
      } else {
        worldRect(ctx,x-54,y-49,108,98,'#d2c8a7');
        worldRect(ctx,x-59,y+51,118,8,'#f3e9cc');
        for(let u=-65;u<70;u+=20) {
          worldLine(ctx,[[x+u,y+61],[x+u,y+71]],'#cfc6a6',.7);
          worldLine(ctx,[[x+61,y+u],[x+71,y+u]],'#cfc6a6',.7);
        }
      }
    }));
    const roads=[65,290,510,730,950];
    for(const r of roads) {
      worldRect(ctx,r-51,10,102,980,'#d4cfb0');
      worldRect(ctx,10,r-51,980,102,'#d4cfb0');
    }
    for(const r of roads) {
      worldRect(ctx,r-44,12,88,976,C.road);
      worldRect(ctx,12,r-44,976,88,C.road);
    }
    // Muted lane dashes skip junctions. Small offset strips imply asphalt grain.
    const inJunction=v=>roads.some(r=>Math.abs(v-r)<58);
    for(const r of roads)for(let s=14;s<980;s+=37) {
      if(inJunction(s))continue;
      worldRect(ctx,r-1,s,2,17,C.line);
      worldRect(ctx,s,r-1,17,2,C.line);
    }
    for(const r of roads)for(const cross of roads) {
      if(cross===65||cross===950)continue;
      for(let stripe=-31;stripe<34;stripe+=11) {
        worldRect(ctx,r+stripe,cross-65,6,11,'#e6e4c9');
        worldRect(ctx,cross-65,r+stripe,11,6,'#e6e4c9');
      }
    }
    // Fine curb joints and warm paving make this a toy town rather than a grid.
    for(const r of roads)for(let s=120;s<920;s+=26)if(!inJunction(s)) {
      worldLine(ctx,[[r-51,s],[r-45,s]],'#b6bea4',1);
      worldLine(ctx,[[r+45,s],[r+51,s]],'#b6bea4',1);
      worldLine(ctx,[[s,r-51],[s,r-45]],'#b6bea4',1);
      worldLine(ctx,[[s,r+45],[s,r+51]],'#b6bea4',1);
    }
    // The construction corner has an honest little sand pad.
    worldRect(ctx,801,139,79,37,'#d9c18e');
    worldRect(ctx,803,141,75,33,'#e9d5a6');
    for(let i=0;i<25;i++) {
      const x=810+(i*19)%64,y=145+(i*13)%23;const p=iso(x,y);
      ellipse(ctx,p.x,p.y,1.3,.7,'#cdb789');
    }
    // Low planting at the island edge, deliberately outside the navigable roads.
    for(let i=0;i<33;i++) {
      const s=15+i*30;const p=iso(5,s);ellipse(ctx,p.x,p.y,3.2,1.3,'#90bc98');
      const q=iso(s,995);ellipse(ctx,q.x,q.y,3.2,1.3,'#78ad88');
    }
    worldLine(ctx,[[0,1000],[1000,1000],[1000,0]],'#bcdbb6',2);
  });
  return scene.add.image(-950,-62,'smash-ground').setOrigin(0,0).setDepth(-10000);
}

export function createDecor(scene,district='town') {
  const result=[];
  const add=(key,x,y,scale=1)=>{
    const p=iso(x,y);const view=scene.add.image(p.x,p.y+ART_ANCHOR.decor*scale,key).setOrigin(.5,1).setScale(scale).setDepth(x+y);
    result.push({view,x,y});return view;
  };
  if(district==='industrial') {
    add('industrial-crane',865,111,.92);
    for(const [x,y] of [[119,113],[589,116],[880,349],[125,567],[568,567],[882,787]])add('industrial-pallet',x,y,.78);
    for(const [x,y] of [[585,222],[885,447],[564,672],[121,891],[678,893]])add('industrial-barrels',x,y,.8);
    for(const [x,y] of [[181,105],[343,105],[501,105],[779,107],[400,895],[838,896]])add('industrial-fence',x,y,.85);
    for(const [x,y] of [[120,240],[573,241],[894,241],[245,464],[685,464],[904,683]])add('lamp',x,y,.88);
    for(const [x,y] of [[122,143],[583,143],[127,803],[235,802],[886,677],[886,701]])add('cone',x,y,.9);
    add('car-blue',108,401,.68);add('car-coral',772,840,.65);
    add('industrial-pallet',170,843,1.1);add('industrial-barrels',216,854,1.05);
    add('shrub',899,898,.85);add('shrub',103,908,.9);add('tree-b',917,128,.85);
    return result;
  }
  // Block corners leave both the roads and the destructible footprints clear.
  const centers=[180,400,620,840];
  centers.forEach((x,ix)=>centers.forEach((y,iy)=>{
    const park=(ix===3&&iy===0)||(ix===0&&iy===3);
    if(park)return;
    if((ix+iy)%2===0)add('tree-a',x-61,y-59,.8);
    else add('shrub',x-60,y-58,.9);
    add('shrub',x+60,y-56,.85);
    if((ix+iy)%3===0)add('lamp',x+64,y+63,.88);
    if((ix+iy)%3===1)add('fence',x-15,y+65,.65);
  }));
  // A small garden in the southern corner.
  add('tree-b',142,810,1.05);add('tree-a',214,807,.92);
  add('tree-a',141,879,.9);add('tree-b',221,880,1.04);
  add('bench',169,856,.82);add('lamp',204,850,.84);
  add('shrub',173,809,1);add('shrub',222,848,.9);
  // The opposite park is now a tidy construction yard.
  add('tree-b',793,220,.85);add('tree-a',892,224,.94);
  add('fence',844,239,.9);add('fence',815,121,.75);
  for(const [x,y] of [[797,146],[884,143],[884,178],[799,179]])add('cone',x,y,.9);
  add('shrub',889,197,.8);
  // Parked cars tuck against pavements without narrowing the central lanes.
  add('car-coral',111,404,.68);add('car-blue',771,623,.68);
  add('cone',243,137,.7);add('cone',239,229,.7);
  add('bench',608,684,.64);
  return result;
}
